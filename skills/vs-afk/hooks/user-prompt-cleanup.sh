#!/usr/bin/env bash
# UserPromptSubmit hook for afk.
# If the user is typing, they're back — the afk session is over.
# Wipe the state file so the next Stop allows through and the loop ends.

set -euo pipefail

STATE_FILE="$HOME/.vs/afk/state.json"

rm -f "$STATE_FILE"
exit 0
