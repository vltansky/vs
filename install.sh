#!/usr/bin/env bash
# Install the vs plugin into Claude Code, Codex, and/or Cursor.
#
# Local:  ./install.sh
# Remote: curl -fsSL https://raw.githubusercontent.com/vltansky/vs/main/install.sh | bash
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
  if $market_cmd "$REPO" >"$log" 2>&1 \
    && $market_update_cmd >>"$log" 2>&1 \
    && $install_cmd "$PLUGIN" >>"$log" 2>&1 \
    && { [ -z "$update_cmd" ] || $update_cmd "$PLUGIN" >>"$log" 2>&1; }; then
    ok "$cli: installed $PLUGIN"
  else
    fail "$cli: install failed"
    sed 's/^/      /' "$log"
  fi
  rm -f "$log"
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
install_for codex  "codex plugin marketplace add"  "codex plugin marketplace upgrade vs" "codex plugin add" ""
install_cursor
echo "Done. Restart your agent session (Cursor: Developer: Reload Window) to load vs."
