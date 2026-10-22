#!/usr/bin/env python3

import argparse
import html
import json
import re
import subprocess
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

Snapshot = dict[str, Any]
GH_API_ATTEMPTS = 3
GH_API_RETRY_DELAY = 1.0
FAILURE_CONCLUSIONS = {
    "action_required",
    "cancelled",
    "failure",
    "stale",
    "startup_failure",
    "timed_out",
}
PREVIEW_CONTEXT = re.compile(
    r"\bpreview(?:s| url)?\b|\bdemo\b|\btest (?:this|the) change\b|\bsee it in action\b",
    re.IGNORECASE,
)
PR_LINK_PATTERNS = (
    re.compile(r'\[(?P<label>[^\]]+)\]\((?P<url>https?://[^)\s]+)\)'),
    re.compile(
        r'<a\s+[^>]*href=["\'](?P<url>https?://[^"\']+)["\'][^>]*>'
        r"(?P<label>.*?)</a>",
        re.IGNORECASE | re.DOTALL,
    ),
)


def emit(event: str, snapshot: Snapshot, **details: Any) -> None:
    print(
        json.dumps(
            {"event": event, **details, "snapshot": snapshot},
            separators=(",", ":"),
        ),
        flush=True,
    )


def is_merge_ready(snapshot: Snapshot) -> bool:
    return (
        snapshot.get("state") == "open"
        and snapshot.get("draft", False) is False
        and snapshot.get("ciState") in ("SUCCESS", "NONE")
        and snapshot.get("unresolvedThreads") == 0
        and snapshot.get("reviewDecision") in (None, "APPROVED")
        and snapshot.get("mergeable") is True
    )


DEPLOY_TERMINAL = {"success": "deployed", "failure": "deploy-failed", "timeout": "no-deploy-signal"}
DEPLOY_WORKFLOW = re.compile(r"deploy|release|publish|production", re.IGNORECASE)
DEPLOY_WORKFLOW_OVERRIDE: re.Pattern[str] | None = None
PRODUCTION_ENV = re.compile(r"prod", re.IGNORECASE)
PREVIEW_ENV = re.compile(r"preview|staging|\bdev\b|\bpr[- _]?\d+", re.IGNORECASE)


def terminal_reason(snapshot: Snapshot, until: str) -> str | None:
    if until == "deployed" and snapshot.get("merged"):
        return DEPLOY_TERMINAL.get(str((snapshot.get("deploy") or {}).get("state")))
    if snapshot.get("merged"):
        return "merged"
    if snapshot.get("state") == "closed":
        return "closed"
    if until == "merge-ready" and is_merge_ready(snapshot):
        return "merge-ready"
    return None


def attention_reason(snapshot: Snapshot) -> str | None:
    if snapshot.get("ciState") == "FAILURE":
        return "ci-failure"
    if snapshot.get("unresolvedThreads", 0) > 0:
        return "review-feedback"
    if (
        snapshot.get("state") == "open"
        and snapshot.get("draft") is True
        and snapshot.get("ciState") in ("SUCCESS", "NONE")
        and snapshot.get("unresolvedThreads") == 0
        and snapshot.get("mergeable") is True
    ):
        return "ready-for-review"
    if (
        snapshot.get("state") == "open"
        and snapshot.get("ciState") in ("SUCCESS", "NONE")
        and snapshot.get("unresolvedThreads") == 0
        and snapshot.get("reviewDecision") == "REVIEW_REQUIRED"
        and snapshot.get("mergeable") is True
    ):
        return "review-approval"
    return None


def watch(snapshots: Iterable[Snapshot], until: str, passive: bool = False) -> int:
    previous: Snapshot | None = None
    # A passive watch only reports: it never stops for CI, review, or approval.
    passive = passive or until == "deployed"

    for snapshot in snapshots:
        reason = terminal_reason(snapshot, until)
        if reason:
            emit("terminal", snapshot, reason=reason)
            return 0

        reason = None if passive else attention_reason(snapshot)
        if reason:
            emit("attention", snapshot, reason=reason)
            return 10

        if previous is None:
            emit("baseline", snapshot)
            previous = snapshot
            continue

        if snapshot == previous:
            continue

        changed = [key for key in snapshot if snapshot.get(key) != previous.get(key)]
        emit("change", snapshot, changed=changed)
        previous = snapshot

    return 0


def replay(path: Path) -> Iterable[Snapshot]:
    with path.open() as fixture:
        for line in fixture:
            if line.strip():
                yield json.loads(line)


def gh_json(*args: str, attempts: int = GH_API_ATTEMPTS) -> Snapshot:
    for attempt in range(attempts):
        try:
            result = subprocess.run(
                ["gh", *args],
                check=True,
                capture_output=True,
                text=True,
            )
            return json.loads(result.stdout)
        except subprocess.CalledProcessError:
            if attempt + 1 == attempts:
                raise
            time.sleep(GH_API_RETRY_DELAY * (attempt + 1))

    raise AssertionError("unreachable")


def ci_state(checks: Snapshot, combined: Snapshot) -> tuple[str, list[Snapshot]]:
    check_runs = checks.get("check_runs", [])
    statuses = combined.get("statuses", [])
    failures = [
        {
            "name": check.get("name"),
            "status": check.get("status"),
            "conclusion": check.get("conclusion"),
            "detailsUrl": check.get("details_url"),
        }
        for check in check_runs
        if check.get("conclusion") in FAILURE_CONCLUSIONS
    ]
    if failures or combined.get("state") == "failure":
        return "FAILURE", failures
    if any(check.get("status") != "completed" for check in check_runs):
        return "PENDING", failures
    if statuses and combined.get("state") == "pending":
        return "PENDING", failures
    if check_runs or statuses:
        return "SUCCESS", failures
    return "NONE", failures


def fetch_review(repo: str, pr: int) -> tuple[str | None, int]:
    owner, name = repo.split("/", 1)
    result = gh_json(
        "api",
        "graphql",
        "-f",
        "query=query($owner:String!,$name:String!,$pr:Int!){repository(owner:$owner,name:$name){pullRequest(number:$pr){reviewDecision reviewThreads(first:100){nodes{isResolved}}}}}",
        "-f",
        f"owner={owner}",
        "-f",
        f"name={name}",
        "-F",
        f"pr={pr}",
    )
    pull_request = result["data"]["repository"]["pullRequest"]
    unresolved = sum(
        not thread["isResolved"] for thread in pull_request["reviewThreads"]["nodes"]
    )
    return pull_request.get("reviewDecision"), unresolved


def fetch_requested_reviewers(pull_request: Snapshot) -> list[str]:
    reviewers = {
        reviewer.get("login")
        for reviewer in pull_request.get("requested_reviewers") or []
        if isinstance(reviewer.get("login"), str) and reviewer.get("login")
    }
    return sorted(reviewers)


def fetch_approval_candidates(repo: str, pr: int, pull_request: Snapshot) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()

    def add(login: Any) -> None:
        if not isinstance(login, str) or not login or login in seen:
            return
        seen.add(login)
        candidates.append(login)

    for login in fetch_requested_reviewers(pull_request):
        add(login)

    try:
        reviews = gh_json(
            "api", f"repos/{repo}/pulls/{pr}/reviews?per_page=100", attempts=1
        )
    except subprocess.CalledProcessError:
        return candidates
    for review in reversed(reviews):
        if review.get("state") == "APPROVED":
            add((review.get("user") or {}).get("login"))
    return candidates


def fetch_approval_teams(pull_request: Snapshot) -> list[str]:
    teams = {
        team.get("slug")
        for team in pull_request.get("requested_teams") or []
        if isinstance(team.get("slug"), str) and team.get("slug")
    }
    return sorted(teams)


def fetch_preview_urls(repo: str, head_sha: str) -> list[str]:
    try:
        deployments = gh_json(
            "api",
            f"repos/{repo}/deployments?sha={head_sha}&per_page=100",
            attempts=1,
        )
    except subprocess.CalledProcessError:
        return []
    preview_urls: list[str] = []
    for deployment in deployments:
        environment = str(deployment.get("environment") or "").casefold()
        is_preview = (
            deployment.get("transient_environment") is True
            or "preview" in environment
            or re.search(
                r"(?:^|[^a-z0-9])pr[- _/]?\d+(?:$|[^a-z0-9])", environment
            )
            is not None
        )
        if deployment.get("production_environment") is True or not is_preview:
            continue
        statuses_url = str(deployment["statuses_url"])
        statuses_endpoint = urlparse(statuses_url).path.lstrip("/")
        try:
            statuses = gh_json("api", statuses_endpoint, attempts=1)
        except subprocess.CalledProcessError:
            continue
        if not statuses:
            continue
        latest_status = statuses[0]
        url = latest_status.get("environment_url")
        if latest_status.get("state") != "success" or not isinstance(url, str):
            continue
        if not url.startswith(("https://", "http://")) or url in preview_urls:
            continue
        preview_urls.append(url)
    return preview_urls


def deploy_from_deployment(deployment: Snapshot, sha: str) -> Snapshot | None:
    statuses_endpoint = urlparse(str(deployment["statuses_url"])).path.lstrip("/")
    try:
        statuses = gh_json("api", statuses_endpoint, attempts=1)
    except subprocess.CalledProcessError:
        return None
    latest = statuses[0] if statuses else {}
    state = {"success": "success", "failure": "failure", "error": "failure"}.get(
        str(latest.get("state")), "pending"
    )
    return {
        "state": state,
        "source": "deployment",
        "environment": deployment.get("environment"),
        "sha": deployment.get("sha") or sha,
        "at": latest.get("created_at") or deployment.get("created_at"),
        "url": latest.get("environment_url"),
    }


def contains_commit(repo: str, base: str, head: str) -> bool:
    if base == head:
        return True
    try:
        compare = gh_json("api", f"repos/{repo}/compare/{base}...{head}", attempts=1)
    except subprocess.CalledProcessError:
        return False
    return compare.get("status") in ("ahead", "identical")


def fetch_production_deploy(
    repo: str, sha: str, merged_at: str | None = None, workflow: re.Pattern[str] = DEPLOY_WORKFLOW
) -> Snapshot:
    """Find the production deploy of the merge commit: a GitHub production
    deployment of that sha or a later one, else the deploy workflow runs on it."""
    try:
        deployments = gh_json("api", f"repos/{repo}/deployments?per_page=30", attempts=1)
    except subprocess.CalledProcessError:
        deployments = []
    for deployment in deployments:
        if merged_at and str(deployment.get("created_at") or "") < merged_at:
            break
        environment = str(deployment.get("environment") or "")
        if deployment.get("transient_environment") is True or PREVIEW_ENV.search(environment) or not (
            deployment.get("production_environment") is True or PRODUCTION_ENV.search(environment)
        ):
            continue
        if not contains_commit(repo, sha, str(deployment.get("sha") or "")):
            continue
        found = deploy_from_deployment(deployment, sha)
        if found:
            return found
    try:
        runs = gh_json("api", f"repos/{repo}/actions/runs?head_sha={sha}&per_page=100", attempts=1)
    except subprocess.CalledProcessError:
        runs = {}
    latest: dict[str, Snapshot] = {}
    for run in runs.get("workflow_runs", []):
        label = f"{run.get('name', '')} {run.get('path', '')}"
        if not workflow.search(label) or PREVIEW_ENV.search(label) or run.get("conclusion") == "skipped":
            continue
        key = str(run.get("path") or run.get("name"))
        if key not in latest or str(run.get("created_at")) > str(latest[key].get("created_at")):
            latest[key] = run
    if not latest:
        return {"state": "none", "sha": sha}
    items = [
        {
            "name": run.get("name"),
            "state": "pending" if run.get("status") != "completed"
            else ("success" if run.get("conclusion") == "success" else "failure"),
            "at": run.get("updated_at"),
            "url": run.get("html_url"),
        }
        for run in latest.values()
    ]
    states = {item["state"] for item in items}
    state = "pending" if "pending" in states else ("failure" if "failure" in states else "success")
    return {
        "state": state,
        "source": "workflow",
        "sha": sha,
        "at": max(str(item["at"]) for item in items),
        "runs": items,
    }


def extract_preview_candidates(body: str) -> list[str]:
    decoded = html.unescape(body)
    matches: list[tuple[int, str]] = []
    for pattern in PR_LINK_PATTERNS:
        for match in pattern.finditer(decoded):
            line_start = decoded.rfind("\n", 0, match.start()) + 1
            context = f"{decoded[line_start:match.start()]} {match.group('label')}"
            url = match.group("url")
            if not PREVIEW_CONTEXT.search(context):
                continue
            matches.append((match.start(), url))
    candidates: list[str] = []
    seen: set[str] = set()
    for _, url in sorted(matches):
        if url in seen:
            continue
        seen.add(url)
        candidates.append(url)
    return candidates


def fetch_preview_candidates(repo: str, pr: int) -> list[str]:
    try:
        comments = gh_json(
            "api", f"repos/{repo}/issues/{pr}/comments?per_page=100", attempts=1
        )
    except subprocess.CalledProcessError:
        return []
    candidates: list[str] = []
    seen: set[str] = set()
    for comment in comments:
        if comment.get("user", {}).get("type") != "Bot":
            continue
        for url in extract_preview_candidates(str(comment.get("body") or "")):
            if url in seen:
                continue
            seen.add(url)
            candidates.append(url)
    return candidates


def fetch_snapshot(
    repo: str, pr: int, previous: Snapshot | None, until: str = "merge-ready"
) -> Snapshot:
    pull_request = gh_json("api", f"repos/{repo}/pulls/{pr}")
    if until == "deployed" and pull_request.get("merged"):
        merge_sha = str(pull_request.get("merge_commit_sha"))
        return {
            "state": pull_request["state"],
            "merged": True,
            "mergeSha": merge_sha,
            "mergedAt": pull_request.get("merged_at"),
            "deploy": fetch_production_deploy(
                repo, merge_sha, pull_request.get("merged_at"), DEPLOY_WORKFLOW_OVERRIDE or DEPLOY_WORKFLOW
            ),
        }
    head_sha = pull_request["head"]["sha"]
    checks = gh_json("api", f"repos/{repo}/commits/{head_sha}/check-runs?per_page=100")
    combined = gh_json("api", f"repos/{repo}/commits/{head_sha}/status")
    current_ci, failures = ci_state(checks, combined)
    preview_urls = fetch_preview_urls(repo, head_sha)
    preview_candidates = [] if preview_urls else fetch_preview_candidates(repo, pr)
    should_fetch_review = (
        previous is None
        or previous.get("headSha") != head_sha
        or current_ci in ("SUCCESS", "NONE")
    )
    if should_fetch_review:
        review_decision, unresolved_threads = fetch_review(repo, pr)
    else:
        review_decision = previous.get("reviewDecision")
        unresolved_threads = previous.get("unresolvedThreads")

    snapshot = {
        "state": pull_request["state"],
        "merged": pull_request["merged"],
        "draft": pull_request.get("draft", False),
        "headSha": head_sha,
        "mergeable": pull_request.get("mergeable"),
        "reviewDecision": review_decision,
        "unresolvedThreads": unresolved_threads,
        "ciState": current_ci,
        "failures": failures,
    }
    if (
        snapshot["state"] == "open"
        and snapshot["ciState"] in ("SUCCESS", "NONE")
        and snapshot["unresolvedThreads"] == 0
        and snapshot["reviewDecision"] == "REVIEW_REQUIRED"
        and snapshot["mergeable"] is True
    ):
        requested_reviewers = fetch_requested_reviewers(pull_request)
        if requested_reviewers:
            snapshot["approvalReviewers"] = requested_reviewers
        approval_candidates = fetch_approval_candidates(repo, pr, pull_request)
        if approval_candidates:
            snapshot["approvalCandidates"] = approval_candidates
        approval_teams = fetch_approval_teams(pull_request)
        if approval_teams:
            snapshot["approvalTeams"] = approval_teams
    if preview_urls:
        snapshot["previewUrls"] = preview_urls
    if preview_candidates:
        snapshot["previewCandidates"] = preview_candidates
    return snapshot


def poll_github(
    repo: str,
    pr: int,
    interval: float,
    ready_interval: float,
    max_polls: int | None,
    until: str = "merge-ready",
    deploy_wait: float = 3600,
) -> Iterable[Snapshot]:
    previous: Snapshot | None = None
    poll_count = 0
    merged_seen: float | None = None

    while max_polls is None or poll_count < max_polls:
        snapshot = fetch_snapshot(repo, pr, previous, until)
        deploy = snapshot.get("deploy")
        if deploy is not None:
            merged_seen = merged_seen or time.monotonic()
            if deploy.get("state") == "none" and time.monotonic() - merged_seen >= deploy_wait:
                deploy["state"] = "timeout"
        yield snapshot
        previous = snapshot
        poll_count += 1
        if max_polls is not None and poll_count >= max_polls:
            return
        time.sleep(ready_interval if is_merge_ready(snapshot) else interval)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replay", type=Path)
    parser.add_argument("--repo")
    parser.add_argument("--pr", type=int)
    parser.add_argument("--until", choices=("merge-ready", "merged", "deployed"), default="merge-ready")
    parser.add_argument("--passive", action="store_true", help="report only; never stop for CI, review, or approval")
    parser.add_argument("--deploy-workflow", help="regex for the repo's production deploy workflow names or paths")
    parser.add_argument("--deploy-wait", type=float, default=3600, help="seconds after merge with no deploy signal before no-deploy-signal")
    parser.add_argument("--interval", type=float, default=60)
    parser.add_argument("--ready-interval", type=float, default=300)
    parser.add_argument("--max-polls", type=int)
    return parser.parse_args()


def main() -> None:
    global DEPLOY_WORKFLOW_OVERRIDE
    args = parse_args()
    if args.deploy_workflow:
        DEPLOY_WORKFLOW_OVERRIDE = re.compile(args.deploy_workflow, re.IGNORECASE)
    if args.replay:
        snapshots = replay(args.replay)
    else:
        if not args.repo or args.pr is None:
            raise SystemExit("--repo and --pr are required without --replay")
        snapshots = poll_github(
            args.repo,
            args.pr,
            args.interval,
            args.ready_interval,
            args.max_polls,
            args.until,
            args.deploy_wait,
        )
    raise SystemExit(watch(snapshots, args.until, args.passive))


if __name__ == "__main__":
    main()
