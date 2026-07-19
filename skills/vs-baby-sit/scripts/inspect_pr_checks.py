#!/usr/bin/env python3

# Adapted and modified from OpenAI's gh-fix-ci inspector.
# See ../LICENSE.openai-gh-fix-ci and ../../../THIRD_PARTY_NOTICES.md.

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from shutil import which
from typing import Any


FAILURE_VALUES = {
    "action_required",
    "cancelled",
    "error",
    "failure",
    "stale",
    "startup_failure",
    "timed_out",
}
FAILURE_MARKERS = (
    "error",
    "fail",
    "traceback",
    "exception",
    "assert",
    "panic",
    "fatal",
    "timeout",
    "segmentation fault",
)
PENDING_LOG_MARKERS = (
    "still in progress",
    "log will be available when it is complete",
)


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


def run(args: list[str], cwd: Path) -> CommandResult:
    process = subprocess.run(
        args,
        cwd=cwd,
        text=True,
        capture_output=True,
    )
    return CommandResult(process.returncode, process.stdout, process.stderr)


def run_bytes(args: list[str], cwd: Path) -> tuple[int, bytes, str]:
    process = subprocess.run(args, cwd=cwd, capture_output=True)
    return process.returncode, process.stdout, process.stderr.decode(errors="replace")


def git_root(path: Path) -> Path | None:
    result = run(["git", "rev-parse", "--show-toplevel"], cwd=path)
    if result.returncode != 0:
        return None
    return Path(result.stdout.strip())


def resolve_pr(reference: str | None, cwd: Path) -> str | None:
    if reference:
        return reference

    result = run(["gh", "pr", "view", "--json", "number"], cwd=cwd)
    if result.returncode != 0:
        print((result.stderr or result.stdout).strip() or "Unable to resolve PR.", file=sys.stderr)
        return None

    try:
        number = json.loads(result.stdout).get("number")
    except json.JSONDecodeError:
        number = None

    if number is None:
        print("Unable to parse the current branch PR.", file=sys.stderr)
        return None
    return str(number)


def available_fields(message: str) -> set[str]:
    marker = "Available fields:"
    if marker not in message:
        return set()

    fields: set[str] = set()
    collecting = False
    for line in message.splitlines():
        if marker in line:
            collecting = True
            continue
        if collecting and line.strip():
            fields.add(line.strip())
    return fields


def fetch_checks(pr: str, cwd: Path) -> list[dict[str, Any]] | None:
    preferred = ["name", "state", "conclusion", "detailsUrl", "startedAt", "completedAt"]
    result = run(
        ["gh", "pr", "checks", pr, "--json", ",".join(preferred)],
        cwd=cwd,
    )
    if result.returncode != 0:
        message = "\n".join(part for part in (result.stderr, result.stdout) if part).strip()
        supported = available_fields(message)
        fallback = ["name", "state", "bucket", "link", "startedAt", "completedAt", "workflow"]
        selected = [field for field in fallback if field in supported]
        if not selected:
            print(message or "Unable to inspect PR checks.", file=sys.stderr)
            return None
        result = run(
            ["gh", "pr", "checks", pr, "--json", ",".join(selected)],
            cwd=cwd,
        )

    if result.returncode != 0:
        print((result.stderr or result.stdout).strip() or "Unable to inspect PR checks.", file=sys.stderr)
        return None

    try:
        checks = json.loads(result.stdout)
    except json.JSONDecodeError:
        checks = None
    if not isinstance(checks, list):
        print("Unexpected JSON returned by gh pr checks.", file=sys.stderr)
        return None
    return checks


def normalized(value: Any) -> str:
    return "" if value is None else str(value).strip().lower()


def is_failure(check: dict[str, Any]) -> bool:
    values = (
        check.get("conclusion"),
        check.get("state"),
        check.get("status"),
        check.get("bucket"),
    )
    return any(normalized(value) in FAILURE_VALUES or normalized(value) == "fail" for value in values)


def ids_from_url(url: str) -> tuple[str | None, str | None]:
    run_match = re.search(r"/(?:actions/)?runs/(\d+)", url)
    job_match = re.search(r"/job/(\d+)", url)
    run_id = run_match.group(1) if run_match else None
    job_id = job_match.group(1) if job_match else None
    return run_id, job_id


def repository_from_url(url: str) -> str | None:
    match = re.match(r"https://github\.com/([^/]+/[^/]+)/", url)
    return match.group(1) if match else None


def fetch_run(run_id: str, repository: str, cwd: Path) -> dict[str, Any] | None:
    fields = "conclusion,status,workflowName,name,event,headBranch,headSha,url"
    result = run(
        ["gh", "run", "view", run_id, "--repo", repository, "--json", fields],
        cwd=cwd,
    )
    if result.returncode != 0:
        return None
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def is_pending_log(message: str) -> bool:
    lowered = message.lower()
    return any(marker in lowered for marker in PENDING_LOG_MARKERS)


def repo_slug(cwd: Path) -> str | None:
    result = run(["gh", "repo", "view", "--json", "nameWithOwner"], cwd=cwd)
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout).get("nameWithOwner")
    except json.JSONDecodeError:
        return None


def fetch_log(
    run_id: str,
    job_id: str | None,
    repository: str,
    cwd: Path,
) -> tuple[str, str, str, str]:
    job_error = ""
    if job_id is not None:
        endpoint = f"repos/{repository}/actions/jobs/{job_id}/logs"
        returncode, payload, stderr = run_bytes(["gh", "api", endpoint], cwd=cwd)
        if returncode == 0 and not payload.startswith(b"PK"):
            return payload.decode(errors="replace"), "", "ok", "job"
        job_error = (stderr or payload.decode(errors="replace")).strip()
        if returncode == 0 and payload.startswith(b"PK"):
            job_error = "Job logs returned a zip archive."
        if is_pending_log(job_error):
            return "", job_error, "log_pending", "job"

    result = run(
        ["gh", "run", "view", run_id, "--repo", repository, "--log"],
        cwd=cwd,
    )
    if result.returncode == 0:
        return result.stdout, "", "ok", "run"

    error = (result.stderr or result.stdout).strip() or "Unable to fetch run log."
    if not is_pending_log(error):
        combined_error = "\n".join(part for part in (job_error, error) if part)
        return "", combined_error, "log_unavailable", "run"
    return "", error, "log_pending", "run"


def failure_snippet(log: str, max_lines: int, context: int) -> str:
    lines = log.splitlines()
    if not lines:
        return ""

    marker_index = next(
        (
            index
            for index in range(len(lines) - 1, -1, -1)
            if any(marker in lines[index].lower() for marker in FAILURE_MARKERS)
        ),
        None,
    )
    if marker_index is None:
        return "\n".join(lines[-max_lines:])

    start = max(0, marker_index - context)
    end = min(len(lines), marker_index + context + 1)
    return "\n".join(lines[start:end][-max_lines:])


def analyze(check: dict[str, Any], cwd: Path, max_lines: int, context: int) -> dict[str, Any]:
    url = str(check.get("detailsUrl") or check.get("link") or "")
    run_id, job_id = ids_from_url(url)
    report: dict[str, Any] = {
        "name": check.get("name", ""),
        "detailsUrl": url,
        "runId": run_id,
        "jobId": job_id,
    }
    if run_id is None:
        return {
            **report,
            "provider": "external",
            "status": "external",
            "note": "The check URL is not a GitHub Actions run.",
        }

    repository = repository_from_url(url) or repo_slug(cwd)
    if repository is None:
        return {
            **report,
            "provider": "github-actions",
            "status": "log_unavailable",
            "error": "Unable to resolve the repository for Actions logs.",
        }

    log, error, status, log_scope = fetch_log(run_id, job_id, repository, cwd)
    result = {
        **report,
        "provider": "github-actions",
        "status": status,
        "logScope": log_scope,
        "run": fetch_run(run_id, repository, cwd) or {},
    }
    if error:
        result["error"] = error
    if log:
        result["logSnippet"] = failure_snippet(log, max_lines=max_lines, context=context)
        result["logTail"] = "\n".join(log.splitlines()[-max_lines:])
    return result


def render_text(pr: str, results: list[dict[str, Any]]) -> None:
    print(f"PR {pr}: {len(results)} failing checks analyzed.")
    for result in results:
        print(f"- {result['name']}: {result['status']}")
        if result.get("detailsUrl"):
            print(f"  URL: {result['detailsUrl']}")
        if result.get("error"):
            print(f"  Error: {result['error']}")
        if result.get("logSnippet"):
            print("  Failure snippet:")
            print("\n".join(f"    {line}" for line in result["logSnippet"].splitlines()))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect failing PR checks and Actions logs")
    parser.add_argument("--repo", default=".", help="Path inside the target Git repository")
    parser.add_argument("--pr", help="PR number or URL; defaults to the current branch PR")
    parser.add_argument("--max-lines", type=int, default=160)
    parser.add_argument("--context", type=int, default=30)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = git_root(Path(args.repo))
    if root is None:
        print("Not inside a Git repository.", file=sys.stderr)
        return 2
    if which("gh") is None:
        print("gh is not installed or not on PATH.", file=sys.stderr)
        return 2

    auth = run(["gh", "auth", "status"], cwd=root)
    if auth.returncode != 0:
        print((auth.stderr or auth.stdout).strip() or "gh is not authenticated.", file=sys.stderr)
        return 2

    pr = resolve_pr(args.pr, root)
    if pr is None:
        return 2
    checks = fetch_checks(pr, root)
    if checks is None:
        return 2

    failing = [check for check in checks if is_failure(check)]
    results = [
        analyze(
            check,
            cwd=root,
            max_lines=max(1, args.max_lines),
            context=max(1, args.context),
        )
        for check in failing
    ]
    payload = {"pr": pr, "hasFailures": bool(results), "results": results}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        render_text(pr, results)
    return 1 if results else 0


if __name__ == "__main__":
    raise SystemExit(main())
