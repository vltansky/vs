#!/usr/bin/env bash
# Register or unregister the Ralph stop hook for Claude Code and/or Codex.
# Both hosts share the same Stop-hook contract ({"decision":"block","reason":...} on stdout),
# so one script (ralph-stop.sh) serves both. We write to whichever config files exist.
#
# Usage:
#   install.sh on  <duration_secs>   # start afk loop (default 3600s; explicit 0 = no time cap)
#   install.sh off                    # stop afk loop, clean hook + state

set -euo pipefail

ACTION="${1:-}"
DURATION="${2:-3600}"

SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd)
HOOK_PATH="$SKILL_DIR/hooks/ralph-stop.sh"
CLEANUP_PATH="$SKILL_DIR/hooks/session-start-cleanup.sh"
PROMPT_CLEANUP_PATH="$SKILL_DIR/hooks/user-prompt-cleanup.sh"
chmod +x "$HOOK_PATH" "$CLEANUP_PATH" "$PROMPT_CLEANUP_PATH"

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
STATE_DIR="$HOME/.vs/afk"
STATE_FILE="$STATE_DIR/state.json"

# Target config files — install only into hosts that look active on this machine.
# Both are project-local for symmetric blast radius: the Ralph hook never fires outside this repo.
CLAUDE_SETTINGS="$REPO_ROOT/.claude/settings.local.json"
CODEX_HOOKS="$REPO_ROOT/.codex/hooks.json"

add_hook() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  [[ -f "$path" ]] || echo '{}' > "$path"
  local tmp
  tmp=$(mktemp)
  jq --arg stop_cmd "$HOOK_PATH" --arg start_cmd "$CLEANUP_PATH" --arg prompt_cmd "$PROMPT_CLEANUP_PATH" '
    .hooks = (.hooks // {}) |
    .hooks.Stop = (
      [(.hooks.Stop // [])[] | select(.__tag != "afk-ralph")] +
      [{ __tag: "afk-ralph",
         matcher: "",
         hooks: [{ type: "command", command: $stop_cmd }] }]
    ) |
    .hooks.SessionStart = (
      [(.hooks.SessionStart // [])[] | select(.__tag != "afk-cleanup")] +
      [{ __tag: "afk-cleanup",
         matcher: "",
         hooks: [{ type: "command", command: $start_cmd }] }]
    ) |
    .hooks.UserPromptSubmit = (
      [(.hooks.UserPromptSubmit // [])[] | select(.__tag != "afk-user-cleanup")] +
      [{ __tag: "afk-user-cleanup",
         matcher: "",
         hooks: [{ type: "command", command: $prompt_cmd }] }]
    )
  ' "$path" > "$tmp" && mv "$tmp" "$path"
}

remove_hook() {
  local path="$1"
  [[ -f "$path" ]] || return 0
  local tmp
  tmp=$(mktemp)
  jq '
    if .hooks.Stop then
      .hooks.Stop |= [.[] | select(.__tag != "afk-ralph")]
    else . end
    | if .hooks.SessionStart then
        .hooks.SessionStart |= [.[] | select(.__tag != "afk-cleanup")]
      else . end
    | if .hooks.UserPromptSubmit then
        .hooks.UserPromptSubmit |= [.[] | select(.__tag != "afk-user-cleanup")]
      else . end
    | if (.hooks.Stop // []) | length == 0 then del(.hooks.Stop) else . end
    | if (.hooks.SessionStart // []) | length == 0 then del(.hooks.SessionStart) else . end
    | if (.hooks.UserPromptSubmit // []) | length == 0 then del(.hooks.UserPromptSubmit) else . end
    | if (.hooks // {}) == {} then del(.hooks) else . end
  ' "$path" > "$tmp" && mv "$tmp" "$path"
}

case "$ACTION" in
  on)
    if [[ ! "$DURATION" =~ ^[0-9]+$ ]]; then
      echo "duration must be integer seconds" >&2
      exit 2
    fi

    mkdir -p "$STATE_DIR"
    jq -n --arg ts "$(date +%s)" --argjson dur "$DURATION" \
      '{start_ts: ($ts|tonumber), duration_secs: $dur}' > "$STATE_FILE"

    installed=()
    if [[ -d "$REPO_ROOT/.claude" || -d "$HOME/.claude" ]]; then
      add_hook "$CLAUDE_SETTINGS"
      installed+=("claude:$CLAUDE_SETTINGS")
    fi
    if [[ -d "$REPO_ROOT/.codex" || -d "$HOME/.codex" ]]; then
      add_hook "$CODEX_HOOKS"
      installed+=("codex:$CODEX_HOOKS")
    fi

    if [[ ${#installed[@]} -eq 0 ]]; then
      rm -f "$STATE_FILE"
      echo "no host detected (neither repo-local nor home-level Claude/Codex config present); no hook installed" >&2
      exit 1
    fi
    printf 'afk hook installed (duration=%ss):\n' "$DURATION"
    printf '  - %s\n' "${installed[@]}"
    echo "state: $STATE_FILE"
    echo
    echo "To stop the loop early:"
    echo "  - type anything at the prompt (UserPromptSubmit hook wipes state)"
    echo "  - close/reopen the host (SessionStart hook wipes state)"
    echo "  - manual:  bash $SKILL_DIR/hooks/install.sh off"
    echo "  - nuclear: rm $STATE_FILE"
    ;;
  off)
    rm -f "$STATE_FILE"
    remove_hook "$CLAUDE_SETTINGS"
    remove_hook "$CODEX_HOOKS"
    echo "afk hook removed."
    ;;
  *)
    echo "usage: $0 on <duration_secs> | off" >&2
    exit 2
    ;;
esac
