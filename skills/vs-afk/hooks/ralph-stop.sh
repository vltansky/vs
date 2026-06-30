#!/usr/bin/env bash
# Ralph-style Stop hook for afk.
# Blocks agent stop until the afk session's duration elapses.
# State file at $HOME/.vs/afk/state.json controls the loop.
# Delete the state file to exit the loop early.

set -euo pipefail

STOP_HOOK_ACTIVE=$(jq -r '.stop_hook_active // false' 2>/dev/null || printf 'false')

# Bail out if Claude already retried after a block — avoids infinite loops on catastrophic errors.
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
  exit 0
fi

STATE_FILE="$HOME/.vs/afk/state.json"

# No state = no afk session = allow stop.
[[ -f "$STATE_FILE" ]] || exit 0

START_TS=$(jq -r '.start_ts // empty' "$STATE_FILE" 2>/dev/null || true)
DURATION=$(jq -r '.duration_secs // empty' "$STATE_FILE" 2>/dev/null || true)

# Malformed state file = bail rather than loop blindly.
if [[ -z "$START_TS" || -z "$DURATION" ]]; then
  exit 0
fi
NOW=$(date +%s)
ELAPSED=$(( NOW - START_TS ))

if [[ "$DURATION" -gt 0 && "$ELAPSED" -ge "$DURATION" ]]; then
  rm -f "$STATE_FILE"
  exit 0
fi

if [[ "$DURATION" -eq 0 ]]; then
  REMAINING_MSG="no time cap set"
else
  REMAINING=$(( DURATION - ELAPSED ))
  REMAINING_MSG="${REMAINING}s remaining of ${DURATION}s"
fi

jq -n --arg msg "AFK session active ($REMAINING_MSG). Do not stop. Pull the next task from the work queue per afk Step 4 and keep executing. If no tasks remain, delete the AFK state file and exit cleanly." \
  '{decision: "block", reason: $msg}'
