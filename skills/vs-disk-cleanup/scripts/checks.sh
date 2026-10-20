# Shared by inventory.sh and remove.sh so removal re-applies the exact same rules
# as the inventory (guards against state changing between the two runs).

# Untracked paths matching these basenames are regenerable, so they don't block removal.
JUNK_RE='^(node_modules|build|dist|out|\.next|\.turbo|\.cache|\.playwright-mcp|\.DS_Store|debug\.txt|.*\.log|coverage|\.expo|Pods|\.gradle)$'
# Gitignored files that are usually irreplaceable; `worktree remove --force` deletes them silently.
SECRET_RE='^(\.env(\..+)?|.*\.(pem|key|p12|keystore|jks)|credentials.*|secrets?\..*)$'
SECRET_OK_RE='^\.env\.(example|sample|template|defaults|worktree\.local)$'

data_volume() { [ -d /System/Volumes/Data ] && echo /System/Volumes/Data || echo /; }

busy_cwds() { lsof -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | sort -u; }

is_busy() { # $1 path, $2 newline list of cwds
  local re; re=$(printf '%s' "$1" | sed 's/[][\.*^$+?(){}|]/\\&/g')
  printf '%s\n' "$2" | grep -qxE -- "$re(/.*)?"
}

mtime_day() { stat -f %Sm -t %Y-%m-%d "$1" 2>/dev/null || date -r "$1" +%Y-%m-%d 2>/dev/null; }

# Newest of: last commit, and each changed or untracked non-junk path. The worktree root's own
# mtime is not used: any tool writing at the root bumps it, which kept weeks-idle worktrees RECENT.
last_activity() {
  local c m
  c=$(git -C "$1" log -1 --format=%cs 2>/dev/null)
  m=$(git -C "$1" status --porcelain 2>/dev/null | cut -c4- | sed 's/^"//; s/"$//; s/.* -> //' | while read -r f; do
    [[ "$(basename "${f%/}")" =~ $JUNK_RE ]] || mtime_day "$1/$f"; done | sort | tail -1)
  [[ "$m" > "$c" ]] && echo "$m" || echo "$c"
}

# Prints "<STATUS>\t<reason>". $1 path, $2 cutoff date (YYYY-MM-DD), $3 busy list.
classify() {
  local p=$1 cutoff=$2 busy=$3 last st dirty unpushed track untracked secrets main_wt reasons=()
  git -C "$p" rev-parse HEAD >/dev/null 2>&1 || { printf 'DECIDE\tbroken worktree (main repo missing?)'; return; }
  is_busy "$p" "$busy" && { printf 'BUSY\tprocess cwd inside'; return; }
  last=$(last_activity "$p")
  [[ "$last" < "$cutoff" ]] || { printf 'RECENT\tactive since %s' "$cutoff"; return; }

  st=$(git -C "$p" status --porcelain --ignored 2>/dev/null)
  dirty=$(printf '%s\n' "$st" | grep -cvE '^(\?\?|!!)|^$' || true)
  unpushed=$(git -C "$p" rev-list --count HEAD --not --remotes 2>/dev/null || echo "?")
  untracked=$(printf '%s\n' "$st" | sed -n 's/^?? //p' | while read -r u; do
    b=$(basename "${u%/}"); [[ "$b" =~ $JUNK_RE ]] || printf '%s ' "$u"; done)
  # Worktree setup usually copies .env files from the main checkout; identical copies are not at risk.
  main_wt=$(git -C "$p" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')
  secrets=$(printf '%s\n' "$st" | sed -n 's/^!! //p' | grep -v '/$' | while read -r u; do
    b=$(basename "$u"); [[ "$b" =~ $SECRET_RE && ! "$b" =~ $SECRET_OK_RE ]] || continue
    cmp -s "$p/$u" "$main_wt/$u" || printf '%s ' "$u"; done)

  [ "$dirty" -gt 0 ] && reasons+=("uncommitted=$dirty")
  if [ "$unpushed" != "0" ]; then
    track=$(git -C "$p" for-each-ref --format='%(upstream:track)' "refs/heads/$(git -C "$p" branch --show-current)" 2>/dev/null)
    [ "$track" = "[gone]" ] && reasons+=("unpushed=$unpushed (upstream gone, likely merged)") || reasons+=("unpushed=$unpushed")
  fi
  [ -n "$untracked" ] && reasons+=("untracked: ${untracked% }")
  [ -n "$secrets" ] && reasons+=("ignored secrets: ${secrets% }")

  if [ ${#reasons[@]} -eq 0 ]; then printf 'SAFE\tclean, pushed, idle'
  else local out; out=$(printf '%s; ' "${reasons[@]}"); printf 'DECIDE\t%s' "${out%; }"; fi
}
