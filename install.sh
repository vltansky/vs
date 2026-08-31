#!/usr/bin/env bash
# Install the vs plugin into Claude Code, Codex, and/or Cursor.
#
# Local:  ./install.sh
# Remote: curl -fsSL https://raw.githubusercontent.com/vltansky/vs/master/install.sh | bash
#         gh api repos/vltansky/vs/contents/install.sh -H "Accept: application/vnd.github.raw" | bash
set -euo pipefail

REPO="vltansky/vs"
PLUGIN="vs@vs"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
skip() { printf '  \033[33m-\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; }

install_for() {
  local cli="$1" market_cmd="$2" market_update_cmd="$3" install_cmd="$4" update_cmd="$5"
  if ! command -v "$cli" >/dev/null 2>&1; then
    skip "$cli not found — skipping"
    return
  fi
  local log; log="$(mktemp)"
  if ! { $market_update_cmd >"$log" 2>&1 || $market_cmd "$REPO" >>"$log" 2>&1; }; then
    fail "$cli: install failed"
    sed 's/^/      /' "$log"
  elif [ -n "$update_cmd" ] \
    && { $update_cmd "$PLUGIN" >>"$log" 2>&1 || $install_cmd "$PLUGIN" >>"$log" 2>&1; }; then
    ok "$cli: installed or updated $PLUGIN"
  elif [ -z "$update_cmd" ] && $install_cmd "$PLUGIN" >>"$log" 2>&1; then
    ok "$cli: installed or updated $PLUGIN"
  else
    fail "$cli: install failed"
    sed 's/^/      /' "$log"
  fi
  rm -f "$log"
}

# The ChatGPT desktop app bundles the Codex CLI inside the app without putting
# it on PATH, so `command -v codex` misses it. A shell function makes the
# bundled binary answer to `codex` for both that probe and the commands below.
resolve_codex() {
  if command -v codex >/dev/null 2>&1; then return 0; fi
  local candidate
  # User-local install first, so a stubbed HOME resolves without reaching the
  # real /Applications bundle.
  for candidate in \
    "$HOME/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/ChatGPT.app/Contents/Resources/codex"; do
    [ -x "$candidate" ] || continue
    CODEX_BIN="$candidate"
    codex() { "$CODEX_BIN" "$@"; }
    break
  done
  return 0
}

# Codex dropped plugin-manifest hooks, so the always-on Ponytail hook must be
# registered in ~/.codex/hooks.json. The merge script ships in the plugin.
install_codex_hook() {
  command -v codex >/dev/null 2>&1 || return 0
  local plugin_path
  # awk must consume all input: exiting early SIGPIPEs codex, which panics.
  plugin_path="$(codex plugin list 2>/dev/null | awk '$1 == "vs@vs" && !found { print $NF; found = 1 }')"
  if [ -z "$plugin_path" ] || [ ! -f "$plugin_path/hooks/install-codex-hook.mjs" ]; then
    skip "codex: installed vs plugin not found — ponytail hook not registered"
    return
  fi
  if ! command -v node >/dev/null 2>&1; then
    skip "codex: node not found — ponytail hook not registered"
    return
  fi
  if node "$plugin_path/hooks/install-codex-hook.mjs" >/dev/null 2>&1; then
    ok "codex: ponytail hook registered — approve it when codex asks for hook trust"
  else
    fail "codex: ponytail hook registration failed"
  fi
}

# Cursor has no plugin CLI; the documented path is a local plugin under
# ~/.cursor/plugins/local/. Symlink a clone if we're running from one, else
# clone the repo there.
install_cursor() {
  if [ ! -d "$HOME/.cursor" ] && ! command -v cursor >/dev/null 2>&1; then
    skip "cursor not found — skipping"
    return
  fi
  local dest="$HOME/.cursor/plugins/local/vs"
  mkdir -p "$HOME/.cursor/plugins/local"
  local src=""
  [ -n "${BASH_SOURCE[0]:-}" ] && src="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  if [ -n "$src" ] && [ -f "$src/.cursor-plugin/plugin.json" ]; then
    ln -sfn "$src" "$dest"
    ok "cursor: linked $dest -> $src"
  elif git clone --depth 1 "https://github.com/$REPO" "$dest.tmp" >/dev/null 2>&1; then
    rm -rf "$dest"; mv "$dest.tmp" "$dest"
    ok "cursor: cloned to $dest"
  else
    rm -rf "$dest.tmp"; fail "cursor: clone failed"
  fi
}

echo "Installing vs plugin..."
install_for claude "claude plugin marketplace add" "claude plugin marketplace update vs" "claude plugin install" "claude plugin update"
resolve_codex
install_for codex  "codex plugin marketplace add"  "codex plugin marketplace upgrade vs" "codex plugin add" ""
install_codex_hook
install_cursor
echo "Done. Restart your agent session (Cursor: Developer: Reload Window) to load vs."
