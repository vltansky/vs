---
name: vs-retro
description: "Use when asked for retro, session learnings, what did we learn, or extract learnings. Routes findings to the right destination."
---

# Session Retro

Extract learnings from recent conversations and route them where they belong.

<HARD-GATE>
Do NOT write to any file without presenting findings first. The user reviews and selects which learnings to save.
</HARD-GATE>

## Guardrail: no time estimates

Do not include hours, days, weeks, months, or any wall-clock predictions in findings, summaries, or proposed rules. LLM-generated time estimates are noise — agent-assisted dev speed invalidates the old intuitions anyway. State scope and change, not duration.

## Step 1: Discover sessions

```bash
PROJECT_SLUG=$(pwd | sed 's/[^a-zA-Z0-9]/-/g')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_SLUG"
ls -lt "$SESSION_DIR"/*.jsonl 2>/dev/null | head -5
```

Default: last 3 sessions. Override with `--sessions N`.

If no sessions: "No session transcripts found for this project." Stop.

## Step 2: Extract conversation text

Strip tool_use/tool_result noise. Keep only human-readable user+assistant text.

```bash
jq -r 'select(.message.role == "user" or .message.role == "assistant") |
  .message.role as $role |
  (if (.message.content | type) == "string" then .message.content
   else [.message.content[] | select(.type == "text") | .text] | join("\n")
   end) as $text |
  select($text != "") |
  "\($role): \($text)"' "$SESSION_FILE" | tail -100
```

Node fallback if `jq` unavailable:

```bash
node -e "
const fs=require('fs'),lines=fs.readFileSync(process.argv[1],'utf8').split('\n').filter(Boolean);
for(const l of lines){try{const e=JSON.parse(l);if(!e.message||!['user','assistant'].includes(e.message.role))continue;
const c=e.message.content,t=typeof c==='string'?c:(c||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
if(t)console.log(e.message.role+': '+t.slice(0,2000))}catch{}}
" "$SESSION_FILE" | tail -100
```

Cap at 100 lines per session. Skip sessions under 10 turns.

## Step 3: Analyze

Scan condensed transcripts for learnings. Look for:

| Signal | Pattern | Example |
|--------|---------|---------|
| **Corrections** | "no", "don't", "stop", "wrong", "not that" | User corrects agent behavior |
| **Preferences** | "I prefer", "always", "never", confirmed approaches | User states how they want things done |
| **Gotchas** | Surprising failure, workaround, non-obvious constraint | Something broke unexpectedly |
| **Decisions** | Architecture choice, tool selection, process change | A deliberate choice was made |

For each finding, note:
- The learning (one sentence)
- Evidence quote from the transcript
- Which session and approximate turn

## Step 4: Categorize by destination

Route each finding to where it belongs:

### User CLAUDE.md (`~/.claude/CLAUDE.md`)

Personal preferences and rules that apply across all projects:
- Coding style preferences
- Tool preferences
- Communication style corrections
- Workflow preferences

### Project CLAUDE.md (`.claude/CLAUDE.md` in current repo)

Repo-specific conventions discovered during work:
- Build/test commands that aren't documented
- Repo-specific patterns
- Team conventions

If the file doesn't exist: flag it. Do not create without explicit confirmation.

### Per-skill references (`~/.agents/skills/<name>/references/user-learnings.md`)

Learnings specific to a particular skill's behavior:
- "build-it works better when you provide test commands explicitly"
- "research needs the full function name, not just the class"
- Skill-specific gotchas or workarounds

Only if `~/.agents/skills/<name>/` exists. Skip if the skill directory isn't found.

## Step 5: Present findings

```markdown
## Session Retro — 3 sessions analyzed

### User CLAUDE.md (2 findings)

1. **Prefer early returns over nested conditionals**
   - Evidence: "no don't nest that, use early return" (session 2026-04-12, turn 15)
   - Proposed addition: `- Early returns instead of nested conditionals`

2. **Don't start dev server unless asked**
   - Evidence: "I said don't run dev server" (session 2026-04-11, turn 3)
   - Proposed addition: `- NEVER start dev server unless explicitly told`

### Per-skill: build-it (1 finding)

1. **Always run tsc before committing**
   - Evidence: "build failed because you didn't type-check" (session 2026-04-12, turn 28)
   - File: `~/.agents/skills/vs-build-it/references/user-learnings.md`

### Nothing for project CLAUDE.md this round.

Select findings to save (numbers, 'all', or 'none'):
```

## Step 6: Write selected findings

For each approved finding, write to the designated file:

- **User CLAUDE.md**: Append under the appropriate existing section. If no matching section, append at end.
- **Project CLAUDE.md**: Append. If file doesn't exist, create with a header (only after explicit confirmation in Step 5).
- **Per-skill references**: Append to or create `~/.agents/skills/<name>/references/user-learnings.md` with a dated entry.

Format for per-skill references:

```markdown
# User Learnings

## 2026-04-12

- Always run tsc before committing — build failed when type-check was skipped
```

## What this does NOT do

- Does not modify skill files (that's `improve-skills`)
- Does not analyze git history (that's `vs-retro` and `rules-from-prs`)
- Does not run automatically — explicit invocation only
- Does not extract code patterns (derivable from the code itself)
- Does not duplicate what's already in CLAUDE.md or memory files — check before proposing
