#!/usr/bin/env bash
# Install the vs plugin into Claude Code and/or Codex.
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
  local cli="$1" market_cmd="$2" install_cmd="$3"
  if ! command -v "$cli" >/dev/null 2>&1; then
    skip "$cli not found — skipping"
    return
  fi
  local log; log="$(mktemp)"
  if $market_cmd "$REPO" >"$log" 2>&1 && $install_cmd "$PLUGIN" >>"$log" 2>&1; then
    ok "$cli: installed $PLUGIN"
  else
    fail "$cli: install failed"
    sed 's/^/      /' "$log"
  fi
  rm -f "$log"
}

echo "Installing vs plugin..."
install_for claude "claude plugin marketplace add" "claude plugin install"
install_for codex  "codex plugin marketplace add"  "codex plugin add"
echo "Done. Restart your agent session to load vs."
