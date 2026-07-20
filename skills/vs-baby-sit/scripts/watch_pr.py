#!/usr/bin/env python3

import argparse
import json
import subprocess
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

Snapshot = dict[str, Any]
FAILURE_CONCLUSIONS = {
    "action_required",
    "cancelled",
    "failure",
    "stale",
    "startup_failure",
    "timed_out",
}


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
        and snapshot.get("ciState") in ("SUCCESS", "NONE")
        and snapshot.get("unresolvedThreads") == 0
        and snapshot.get("reviewDecision") in (None, "APPROVED")
        and snapshot.get("mergeable") is True
    )


def terminal_reason(snapshot: Snapshot, until: str) -> str | None:
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
    return None


def watch(snapshots: Iterable[Snapshot], until: str) -> int:
    previous: Snapshot | None = None

    for snapshot in snapshots:
        reason = terminal_reason(snapshot, until)
        if reason:
            emit("terminal", snapshot, reason=reason)
            return 0

        reason = attention_reason(snapshot)
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


def gh_json(*args: str) -> Snapshot:
    result = subprocess.run(
        ["gh", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


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


def fetch_preview_urls(repo: str, head_sha: str) -> list[str]:
    try:
        deployments = gh_json(
            "api", f"repos/{repo}/deployments?sha={head_sha}&per_page=100"
        )
    except subprocess.CalledProcessError:
        return []
    preview_urls: list[str] = []
    for deployment in deployments:
        environment = str(deployment.get("environment") or "").casefold()
        is_preview = deployment.get("transient_environment") is True or "preview" in environment
        if deployment.get("production_environment") is True or not is_preview:
            continue
        statuses_url = str(deployment["statuses_url"])
        statuses_endpoint = urlparse(statuses_url).path.lstrip("/")
        try:
            statuses = gh_json("api", statuses_endpoint)
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


def fetch_snapshot(repo: str, pr: int, previous: Snapshot | None) -> Snapshot:
    pull_request = gh_json("api", f"repos/{repo}/pulls/{pr}")
    head_sha = pull_request["head"]["sha"]
    checks = gh_json("api", f"repos/{repo}/commits/{head_sha}/check-runs?per_page=100")
    combined = gh_json("api", f"repos/{repo}/commits/{head_sha}/status")
    current_ci, failures = ci_state(checks, combined)
    preview_urls = fetch_preview_urls(repo, head_sha)
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
        "headSha": head_sha,
        "mergeable": pull_request.get("mergeable"),
        "reviewDecision": review_decision,
        "unresolvedThreads": unresolved_threads,
        "ciState": current_ci,
        "failures": failures,
    }
    if preview_urls:
        snapshot["previewUrls"] = preview_urls
    return snapshot


def poll_github(
    repo: str,
    pr: int,
    interval: float,
    ready_interval: float,
    max_polls: int | None,
) -> Iterable[Snapshot]:
    previous: Snapshot | None = None
    poll_count = 0

    while max_polls is None or poll_count < max_polls:
        snapshot = fetch_snapshot(repo, pr, previous)
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
    parser.add_argument("--until", choices=("merge-ready", "merged"), default="merge-ready")
    parser.add_argument("--interval", type=float, default=60)
    parser.add_argument("--ready-interval", type=float, default=300)
    parser.add_argument("--max-polls", type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
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
        )
    raise SystemExit(watch(snapshots, args.until))


if __name__ == "__main__":
    main()
