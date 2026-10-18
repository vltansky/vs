#!/usr/bin/env bash
# Classify agent worktrees as SAFE / BUSY / RECENT / DECIDE. Read-only.
# Output TSV: status  path  branch  last_activity  reason
set -uo pipefail
source "$(dirname "$0")/checks.sh"

DAYS=${DAYS:-7}
ROOTS=${WT_ROOTS:-"$HOME/.t3/worktrees $HOME/.codex/worktrees $HOME/Projects/*/.claude/worktrees"}
cutoff=$(date -v-"${DAYS}"d +%Y-%m-%d 2>/dev/null || date -d "-${DAYS} days" +%Y-%m-%d)
busy=$(busy_cwds)

printf "status\tpath\tbranch\tlast_activity\treason\n"
for root in $ROOTS; do
  [ -d "$root" ] || continue
  # A worktree checkout has a .git *file* pointing at the main repo.
  find "$root" -maxdepth 3 -name .git -type f 2>/dev/null | sed 's#/\.git$##'
done | sort -u | while read -r p; do
  branch=$(git -C "$p" branch --show-current 2>/dev/null)
  res=$(classify "$p" "$cutoff" "$busy")
  printf "%s\t%s\t%s\t%s\t%s\n" "${res%%$'\t'*}" "$p" "${branch:--}" "$(last_activity "$p")" "${res#*$'\t'}"
done
