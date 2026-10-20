#!/usr/bin/env bash
# Remove worktrees given on stdin (one path per line) + their local branches.
# Re-runs the full inventory classification per path; anything not SAFE right now is skipped.
# --backup DIR also removes DECIDE worktrees after saving their uncommitted diff, untracked files
# and ignored secrets to DIR; their local branch is kept, so unpushed commits stay in the main repo.
set -uo pipefail
source "$(dirname "$0")/checks.sh"

backup=""
if [ "${1:-}" = --backup ]; then
  backup=${2:?"--backup needs a directory"}
  mkdir -p "$backup" || exit 1
fi

DAYS=${DAYS:-7}
cutoff=$(date -v-"${DAYS}"d +%Y-%m-%d 2>/dev/null || date -d "-${DAYS} days" +%Y-%m-%d)
vol=$(data_volume)
busy=$(busy_cwds)
before=$(df -k "$vol" | awk 'END{print $4}')
mains=()

# Writes <name>.patch (tracked changes vs HEAD) and <name>.files.tgz (untracked + ignored secrets).
save_work() {
  local p=$1 out="$backup/$(basename "$(dirname "$1")")-$(basename "$1")" files
  git -C "$p" diff HEAD --binary > "$out.patch" || return 1
  [ -s "$out.patch" ] || rm -f -- "$out.patch"
  files=$( { git -C "$p" ls-files --others --exclude-standard
    git -C "$p" ls-files --others --ignored --exclude-standard | while read -r f; do
      b=$(basename "$f"); [[ "$b" =~ $SECRET_RE && ! "$b" =~ $SECRET_OK_RE ]] && echo "$f"; done
  } | grep -vE '(^|/)node_modules/')
  [ -z "$files" ] || (cd "$p" && printf '%s\n' "$files" | tar -czf "$out.files.tgz" -T -) || return 1
  echo "$out"
}

while read -r p; do
  [ -n "$p" ] || continue
  [ -f "$p/.git" ] || { echo "SKIP $p (not a worktree)"; continue; }
  res=$(classify "$p" "$cutoff" "$busy")
  status=${res%%$'\t'*}
  saved=""
  if [ "$status" = DECIDE ] && [ -n "$backup" ]; then
    saved=$(save_work "$p") || { echo "SKIP $p (backup failed)"; continue; }
  elif [ "$status" != SAFE ]; then
    echo "SKIP $p (${res//$'\t'/: })"; continue
  fi

  main=$(dirname "$(git -C "$p" rev-parse --path-format=absolute --git-common-dir)")
  branch=$(git -C "$p" branch --show-current)
  if git -C "$main" worktree remove --force "$p"; then
    msg="removed $p"
    if [ -n "$saved" ]; then msg+=" (backed up to $saved.*; branch ${branch:-detached} kept)"
    elif [ -n "$branch" ] && git -C "$main" branch -D "$branch" >/dev/null 2>&1; then msg+=" (branch $branch deleted)"; fi
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
