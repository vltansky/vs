#!/usr/bin/env bash
# Replace the vs Claude plugin with flat user skills (~/.claude/skills/vs-*).
# Workaround for hosts that only see filesystem skills, e.g. T3 Code
# (pingdotgg/t3code#5622, #11575). Skills are symlinked to this clone, so edits
# are live. The plugin's Ponytail hook and octocode MCP are not carried over.
#
#   ./install-flat.sh         disable vs@vs, link skills
#   ./install-flat.sh --undo  remove links, re-enable vs@vs
set -euo pipefail

PLUGIN="vs@vs"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"

# plugin.json is the shipped skill list; skills/ also holds eval-only dirs.
skills=$(node -e 'for (const s of require(process.argv[1]).skills) console.log(s.split("/").pop())' "$ROOT/.claude-plugin/plugin.json")

if [ "${1:-}" = "--undo" ]; then
  for name in $skills; do
    # Only remove links that point into this clone; never touch real dirs.
    if [ -L "$DEST/$name" ] && [ "$(readlink "$DEST/$name")" = "$ROOT/skills/$name" ]; then
      rm "$DEST/$name"
    fi
  done
  claude plugin enable "$PLUGIN" >/dev/null && echo "Removed flat vs skills, re-enabled $PLUGIN."
  exit 0
fi

mkdir -p "$DEST"
linked=0
for name in $skills; do
  if [ -e "$DEST/$name" ] && [ ! -L "$DEST/$name" ]; then
    echo "  skip $name: $DEST/$name exists and is not a symlink" >&2
    continue
  fi
  ln -sfn "$ROOT/skills/$name" "$DEST/$name"
  linked=$((linked + 1))
done

# Disable rather than uninstall so --undo restores the same install.
claude plugin disable "$PLUGIN" >/dev/null 2>&1 || echo "  $PLUGIN was not enabled" >&2
echo "Linked $linked vs skills into $DEST, disabled $PLUGIN. Restart Claude Code / T3 Code."
