#!/usr/bin/env bash
# Replace the vs plugin with flat user skills symlinked to this clone, so edits
# are live in every host. Workaround for hosts that only see filesystem skills,
# e.g. T3 Code (pingdotgg/t3code#5622, #11575).
#
#   Claude Code  ~/.claude/skills/vs-*   vs@vs disabled; Ponytail hook and
#                                        octocode MCP are not carried over
#   Codex        ~/.agents/skills/vs-*   vs@vs removed; vs-artifact MCP and
#                                        Ponytail hook point at this clone
#   Cursor       nothing to link: it also loads ~/.claude/skills
#
#   ./install-flat.sh         disable the plugins, link skills
#   ./install-flat.sh --undo  remove links, restore the plugins
set -euo pipefail

PLUGIN="vs@vs"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
# ~/.agents/skills is Codex's documented user scope; Cursor reads it too.
CODEX_DEST="$HOME/.agents/skills"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

# plugin.json is the shipped skill list; skills/ also holds eval-only dirs.
skills=$(node -e 'for (const s of require(process.argv[1]).skills) console.log(s.split("/").pop())' "$ROOT/.claude-plugin/plugin.json")

has() { command -v "$1" >/dev/null 2>&1; }

link_skills() {
  local dest="$1" linked=0 name
  mkdir -p "$dest"
  for name in $skills; do
    if [ -e "$dest/$name" ] && [ ! -L "$dest/$name" ]; then
      echo "  skip $name: $dest/$name exists and is not a symlink" >&2
      continue
    fi
    ln -sfn "$ROOT/skills/$name" "$dest/$name"
    linked=$((linked + 1))
  done
  echo "$linked"
}

unlink_skills() {
  local dest="$1" name
  for name in $skills; do
    # Only remove links that point into this clone; never touch real dirs.
    if [ -L "$dest/$name" ] && [ "$(readlink "$dest/$name")" = "$ROOT/skills/$name" ]; then
      rm "$dest/$name"
    fi
  done
}

# Copies left by `install.sh --codex-flat` would shadow or duplicate the links.
warn_codex_copies() {
  local name
  for name in $skills; do
    if [ -d "$CODEX_HOME/skills/$name" ] && [ ! -L "$CODEX_HOME/skills/$name" ]; then
      echo "  stale copy $CODEX_HOME/skills/$name (from --codex-flat); remove it" >&2
    fi
  done
}

if [ "${1:-}" = "--undo" ]; then
  unlink_skills "$CLAUDE_DEST"
  has claude && claude plugin enable "$PLUGIN" >/dev/null
  echo "claude: removed flat skills, re-enabled $PLUGIN"
  unlink_skills "$CODEX_DEST"
  if has codex; then
    codex mcp remove vs-artifact >/dev/null 2>&1 || true
    codex plugin add "$PLUGIN" >/dev/null
    # The Ponytail hook keeps pointing at this clone; ./install.sh repoints it.
    echo "codex: removed flat skills and vs-artifact MCP, re-added $PLUGIN"
  fi
  echo "Restart Claude Code / Codex / Cursor / T3 Code."
  exit 0
fi

echo "claude: linked $(link_skills "$CLAUDE_DEST") skills into $CLAUDE_DEST"
# Disable rather than uninstall so --undo restores the same install.
if has claude; then
  claude plugin disable "$PLUGIN" >/dev/null 2>&1 || echo "  $PLUGIN was not enabled" >&2
fi

echo "codex: linked $(link_skills "$CODEX_DEST") skills into $CODEX_DEST"
if has codex; then
  # Codex has no plugin disable; --undo re-adds it from the marketplace.
  codex plugin remove "$PLUGIN" >/dev/null 2>&1 || echo "  $PLUGIN was not installed" >&2
  # Flat skills carry no MCP manifest, so register the server from this clone.
  [ -f "$ROOT/mcp/dist/server.mjs" ] || echo "  mcp/dist missing; run npm run build:mcp" >&2
  codex mcp add vs-artifact -- node "$ROOT/mcp/dist/server.mjs" >/dev/null
  node "$ROOT/hooks/install-codex-hook.mjs" >/dev/null
  echo "codex: removed $PLUGIN, vs-artifact MCP and Ponytail hook point at $ROOT"
  warn_codex_copies
fi

if [ -e "$HOME/.cursor/plugins/local/vs" ]; then
  echo "  cursor: ~/.cursor/plugins/local/vs duplicates the flat skills; remove it" >&2
fi
echo "cursor: uses $CLAUDE_DEST"
echo "Restart Claude Code / Codex / Cursor / T3 Code."
