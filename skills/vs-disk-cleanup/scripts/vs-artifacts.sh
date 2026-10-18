#!/usr/bin/env bash
# Classify vs session artifacts under ~/.vs/<project>/<kind>/ as STALE / RECENT / KEEP / REVIEW.
#   vs-artifacts.sh            read-only inventory, TSV: status kb last_used path reason
#   vs-artifacts.sh --remove   paths on stdin; re-classifies each, moves only STALE ones to Trash
# Env: DAYS (idle threshold, default 30), VS_HOME (default ~/.vs).
set -uo pipefail

VS_HOME=${VS_HOME:-$HOME/.vs}
DAYS=${DAYS:-30}
# Durable outputs that later work reads back (design docs, RFCs, issue indexes, per-repo context,
# improve backlogs). Never offered: losing one loses a decision, not a rendering.
KEEP_KINDS='^(context|specs|rfcs|issues|improve)$'
# One-off renderings and evidence: regenerable or only useful for the session that made them.
EPHEMERAL_KINDS='^(videos|vs-show-me|build-it|ship-it|qa-reports|prototypes|explanations|interactive-explanations|eli5|reviews|verification|pushback|steals|thread-analysis|briefs|vs-octocode|pr-[0-9]+)$'
# Regression baselines inside ephemeral kinds: vs-qa/vs-perf diff against them on the next run.
KEEP_ENTRY='^baseline\.(json|png)$'

cutoff=$(( $(date +%s) - DAYS * 86400 ))
# BSD (macOS) and GNU stat spell "mtime as epoch" differently.
if stat -f %m / >/dev/null 2>&1; then STAT=(stat -f %m); else STAT=(stat -c %Y); fi

# Newest file mtime under $1 (metadata only); falls back to the path's own mtime when it has no files.
last_used() {
  local t
  t=$(find "$1" -type f -exec "${STAT[@]}" {} + 2>/dev/null | sort -n | tail -1)
  [ -n "$t" ] && echo "$t" || "${STAT[@]}" "$1"
}

# Prints "<STATUS>\t<reason>" for one inventory row. $1 path, $2 kind ("" for loose files), $3 basename.
classify() {
  local p=$1 kind=$2 name=$3
  [ -z "$kind" ] && { printf 'REVIEW\tloose file outside a kind dir'; return; }
  [[ "$kind" =~ $KEEP_KINDS ]] && { printf 'KEEP\tdurable kind: %s' "$kind"; return; }
  [[ "$kind" =~ $EPHEMERAL_KINDS ]] || { printf 'REVIEW\tunknown or stateful kind: %s' "$kind"; return; }
  [[ "$name" =~ $KEEP_ENTRY ]] && { printf 'KEEP\tregression baseline'; return; }
  [ "$(last_used "$p")" -lt "$cutoff" ] && printf 'STALE\tidle >= %sd in %s' "$DAYS" "$kind" \
    || printf 'RECENT\tused within %sd' "$DAYS"
}

row() { # $1 path $2 kind $3 name
  local res kb ts
  res=$(classify "$1" "$2" "$3")
  kb=$(du -sk "$1" 2>/dev/null | awk '{print $1}')
  ts=$(last_used "$1")
  printf '%s\t%s\t%s\t%s\t%s\n' "${res%%$'\t'*}" "${kb:-0}" "$(date -r "$ts" +%Y-%m-%d 2>/dev/null || date -d "@$ts" +%Y-%m-%d)" "$1" "${res#*$'\t'}"
}

inventory() {
  printf 'status\tkb\tlast_used\tpath\treason\n'
  [ -d "$VS_HOME" ] || return 0
  local proj kind entry
  for proj in "$VS_HOME"/*; do
    [ -e "$proj" ] || continue
    [ -d "$proj" ] || { row "$proj" "" "$(basename "$proj")"; continue; }
    for kind in "$proj"/*; do
      [ -e "$kind" ] || continue
      local k; k=$(basename "$kind")
      if [ ! -d "$kind" ]; then row "$kind" "" "$k"
      elif [[ "$k" =~ $EPHEMERAL_KINDS ]] && [[ ! "$k" =~ ^pr-[0-9]+$ ]]; then
        # Per entry, so recent renderings in a kind don't shield stale ones beside them.
        for entry in "$kind"/*; do [ -e "$entry" ] && row "$entry" "$k" "$(basename "$entry")"; done
      else row "$kind" "$k" "$k"
      fi
    done
  done
}

to_trash() {
  if command -v trash >/dev/null 2>&1; then trash "$1"
  elif [ -d "$HOME/.Trash" ]; then mv "$1" "$HOME/.Trash/$(basename "$1").$(date +%s)"
  else echo "FAILED $1 (no trash command and no ~/.Trash; install trash-cli)" >&2; return 1
  fi
}

remove() {
  local root p rel kind name res kb moved=0 total=0
  root=$(cd "$VS_HOME" 2>/dev/null && pwd -P) || { echo "nothing to do: $VS_HOME missing"; return 0; }
  while read -r p || [ -n "$p" ]; do
    [ -n "$p" ] && [ -e "$p" ] || continue
    p=$(cd "$(dirname "$p")" && pwd -P)/$(basename "$p")
    # Only paths inside ~/.vs; a stray line from another TSV must never reach Trash.
    case "$p" in "$root"/*/*) ;; *) echo "SKIP $p (not under $root/<project>/)"; continue ;; esac
    rel=${p#"$root"/}; rel=${rel#*/}; name=$(basename "$p")
    if [ "$rel" = "$name" ] && [ ! -d "$p" ]; then kind=""; else kind=${rel%%/*}; fi
    # The inventory lists ephemeral kinds per entry; a whole kind dir would sweep its baselines too.
    [[ "$kind" =~ $EPHEMERAL_KINDS && ! "$kind" =~ ^pr-[0-9]+$ ]] && [ "$rel" = "$kind" ] \
      && { echo "SKIP $p (kind dir; pass its entries)"; continue; }
    res=$(classify "$p" "$kind" "$name")
    [ "${res%%$'\t'*}" = STALE ] || { echo "SKIP $p (${res//$'\t'/: })"; continue; }
    kb=$(du -sk "$p" | awk '{print $1}')
    to_trash "$p" && { echo "trashed $p"; moved=$((moved + 1)); total=$((total + kb)); }
  done
  # Kind and project dirs emptied by this run; skills recreate them with mkdir -p.
  find "$root" -mindepth 1 -type d -empty -delete 2>/dev/null
  echo "moved $moved entries ($(( total / 1024 )) MB) to Trash; space frees after Trash is emptied"
}

case "${1:-}" in
  --remove) remove ;;
  "") inventory ;;
  *) echo "usage: $0 [--remove]  (inventory by default; --remove reads paths on stdin)" >&2; exit 2 ;;
esac
