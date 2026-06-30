#!/usr/bin/env bash
# SessionStart hook for afk.
# A new session starting in this project means any previous afk session is over.
# Wipe the stale state file and let the Stop hook short-circuit on the next stop.

set -euo pipefail

STATE_FILE="$HOME/.vs/afk/state.json"

rm -f "$STATE_FILE"
exit 0
