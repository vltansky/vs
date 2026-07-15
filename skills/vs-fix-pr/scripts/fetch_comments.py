#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Callable
from typing import Any


PR_META_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      url
      title
      state
      headRefName
      baseRefName
      reviewDecision
    }
  }
}
"""

CONVERSATION_COMMENTS_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          databaseId
          body
          createdAt
          updatedAt
          url
          author { login }
        }
      }
    }
  }
}
"""

REVIEWS_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          state
          body
          submittedAt
          url
          author { login }
        }
      }
    }
  }
}
"""

REVIEW_THREADS_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          diffSide
          startLine
          startDiffSide
          originalLine
          originalStartLine
          resolvedBy { login }
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              databaseId
              body
              createdAt
              updatedAt
              url
              author { login }
            }
          }
        }
      }
    }
  }
}
"""

THREAD_COMMENTS_QUERY = """\
query($threadId: ID!, $cursor: String) {
  node(id: $threadId) {
    ... on PullRequestReviewThread {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          databaseId
          body
          createdAt
          updatedAt
          url
          author { login }
        }
      }
    }
  }
}
"""


def run(cmd: list[str], stdin: str | None = None) -> str:
    process = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if process.returncode == 0:
        return process.stdout

    raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{process.stderr}")


def run_json(cmd: list[str], stdin: str | None = None) -> dict[str, Any]:
    output = run(cmd, stdin=stdin)
    try:
        return json.loads(output)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Failed to parse command JSON: {error}\n{output}") from error


def parse_pr_url(url: str) -> tuple[str, str, int]:
    match = re.fullmatch(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)/?", url)
    if match:
        return match.group(1), match.group(2), int(match.group(3))

    raise RuntimeError(f"Unsupported GitHub PR URL: {url}")


def resolve_pr(reference: str | None) -> tuple[str, str, int, str]:
    cmd = ["gh", "pr", "view"]
    if reference:
        cmd.append(reference)
    cmd += ["--json", "number,url"]

    pr = run_json(cmd)
    owner, repo, url_number = parse_pr_url(pr["url"])
    number = int(pr["number"])
    if number != url_number:
        raise RuntimeError(f"PR number mismatch: gh returned {number}, URL contains {url_number}")

    return owner, repo, number, pr["url"]


def graphql(query: str, **variables: str | int | None) -> dict[str, Any]:
    cmd = ["gh", "api", "graphql", "-F", "query=@-"]
    for name, value in variables.items():
        if value is not None:
            cmd += ["-F", f"{name}={value}"]

    payload = run_json(cmd, stdin=query)
    if payload.get("errors"):
        raise RuntimeError(f"GitHub GraphQL errors:\n{json.dumps(payload['errors'], indent=2)}")
    return payload


def paginate(
    fetch_page: Callable[[str | None], dict[str, Any]],
    first_page: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    cursor: str | None = None
    page = first_page

    while True:
        current_page = page if page is not None else fetch_page(cursor)
        page = None
        nodes.extend(current_page.get("nodes") or [])

        page_info = current_page["pageInfo"]
        if not page_info["hasNextPage"]:
            return nodes

        cursor = page_info.get("endCursor")
        if cursor is None:
            raise RuntimeError("GitHub reported a next page but is missing an end cursor")


def pr_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    repository = payload.get("data", {}).get("repository")
    pr = repository.get("pullRequest") if repository else None
    if pr is not None:
        return pr

    raise RuntimeError("GitHub could not find the pull request in the base repository")


def fetch_connection(
    query: str,
    connection_name: str,
    owner: str,
    repo: str,
    number: int,
) -> list[dict[str, Any]]:
    def fetch_page(cursor: str | None) -> dict[str, Any]:
        payload = graphql(
            query,
            owner=owner,
            repo=repo,
            number=number,
            cursor=cursor,
        )
        return pr_from_payload(payload)[connection_name]

    return paginate(fetch_page)


def fetch_thread_comments(thread: dict[str, Any]) -> dict[str, Any]:
    comments = thread["comments"]
    if not comments["pageInfo"]["hasNextPage"]:
        return thread

    def fetch_page(cursor: str | None) -> dict[str, Any]:
        payload = graphql(THREAD_COMMENTS_QUERY, threadId=thread["id"], cursor=cursor)
        node = payload.get("data", {}).get("node")
        if node is not None:
            return node["comments"]
        raise RuntimeError(f"GitHub could not find review thread {thread['id']}")

    return {
        **thread,
        "comments": {"nodes": paginate(fetch_page, first_page=comments)},
    }


def fetch_all(owner: str, repo: str, number: int, url: str) -> dict[str, Any]:
    meta = pr_from_payload(
        graphql(PR_META_QUERY, owner=owner, repo=repo, number=number),
    )
    threads = fetch_connection(
        REVIEW_THREADS_QUERY,
        "reviewThreads",
        owner,
        repo,
        number,
    )

    return {
        "pull_request": {**meta, "url": url, "owner": owner, "repo": repo},
        "conversation_comments": fetch_connection(
            CONVERSATION_COMMENTS_QUERY,
            "comments",
            owner,
            repo,
            number,
        ),
        "reviews": fetch_connection(
            REVIEWS_QUERY,
            "reviews",
            owner,
            repo,
            number,
        ),
        "review_threads": [fetch_thread_comments(thread) for thread in threads],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch complete thread-aware PR feedback")
    parser.add_argument("--pr", help="PR number or URL; defaults to the current branch PR")
    args = parser.parse_args()

    try:
        run(["gh", "auth", "status"])
        owner, repo, number, url = resolve_pr(args.pr)
        print(json.dumps(fetch_all(owner, repo, number, url), indent=2))
    except RuntimeError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
