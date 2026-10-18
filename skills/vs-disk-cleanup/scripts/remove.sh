#!/usr/bin/env bash
# Remove worktrees given on stdin (one path per line) + their local branches.
# Re-runs the full inventory classification per path; anything not SAFE right now is skipped.
set -uo pipefail
source "$(dirname "$0")/checks.sh"

DAYS=${DAYS:-7}
cutoff=$(date -v-"${DAYS}"d +%Y-%m-%d 2>/dev/null || date -d "-${DAYS} days" +%Y-%m-%d)
vol=$(data_volume)
busy=$(busy_cwds)
before=$(df -k "$vol" | awk 'END{print $4}')
mains=()

while read -r p; do
  [ -n "$p" ] || continue
  [ -f "$p/.git" ] || { echo "SKIP $p (not a worktree)"; continue; }
  res=$(classify "$p" "$cutoff" "$busy")
  [ "${res%%$'\t'*}" = SAFE ] || { echo "SKIP $p (${res//$'\t'/: })"; continue; }

  main=$(dirname "$(git -C "$p" rev-parse --path-format=absolute --git-common-dir)")
  branch=$(git -C "$p" branch --show-current)
  if git -C "$main" worktree remove --force "$p"; then
    msg="removed $p"
    [ -n "$branch" ] && git -C "$main" branch -D "$branch" >/dev/null 2>&1 && msg+=" (branch $branch deleted)"
    echo "$msg"
    # Codex nests checkouts as .codex/worktrees/<id>/<repo>; drop the now-empty <id> dir.
    rmdir "$(dirname "$p")" 2>/dev/null || true
    mains+=("$main")
  else
    echo "FAILED $p"
  fi
done

for m in $(printf '%s\n' "${mains[@]:-}" | sort -u); do git -C "$m" worktree prune; done
after=$(df -k "$vol" | awk 'END{print $4}')
echo "freed: $(( (after - before) / 1024 )) MB; free now: $(df -h "$vol" | awk 'END{print $4}')"
