#!/usr/bin/env bash
# Delete regenerable, gitignored dirs (node_modules, caches, native builds) inside worktrees
# given on stdin. Keeps all commits, changes and untracked files; `pnpm install` restores.
# Usage: awk -F'\t' '$1=="DECIDE"{print $2}' wt.tsv | slim.sh [--dry-run]
set -uo pipefail
source "$(dirname "$0")/checks.sh"

dry=${1:-}
vol=$(data_volume)
busy=$(busy_cwds)
before=$(df -k "$vol" | awk 'END{print $4}')
n=0

while read -r wt; do
  [ -f "$wt/.git" ] || continue
  # Re-check: a process may have started in it since the inventory.
  is_busy "$wt" "$busy" && { echo "SKIP busy $wt"; continue; }
  while read -r d; do
    [ -n "$d" ] || continue
    # Only gitignored paths; never touch anything git tracks or would report as untracked work.
    git -C "$wt" check-ignore -q "$d" || { echo "SKIP not-ignored $d"; continue; }
    if [ "$dry" = --dry-run ]; then du -sh "$d" 2>/dev/null; else rm -rf "$d" && n=$((n + 1)); fi
  done < <(find "$wt" \( -name node_modules -o -name .cache -o -name .turbo -o -name .next -o -name .expo \
      -o -path '*/android/build' -o -path '*/android/app/build' -o -path '*/ios/build' \) -prune -type d -print 2>/dev/null)
done

after=$(df -k "$vol" | awk 'END{print $4}')
[ "$dry" = --dry-run ] || echo "deleted $n dirs; freed: $(( (after - before) / 1024 )) MB; free now: $(df -h "$vol" | awk 'END{print $4}')"
