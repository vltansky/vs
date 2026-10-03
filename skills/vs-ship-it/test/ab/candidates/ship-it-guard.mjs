#!/usr/bin/env node
// Candidate PreToolUse(Bash) hook for the ship-it A/B: deny a raw `gh pr create`
// when vs-ship-it was never loaded in this session, and tell the agent to load it.
// Staged into the sandbox by the `v9-guard-hook` variant; not shipped until it wins.
// Fails open on any parse or read error so a broken hook never blocks publishing.
import fs from 'node:fs';

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
const command = input?.tool_input?.command ?? '';
if (!/\bgh\s+pr\s+create\b/.test(command)) process.exit(0);

let transcript = '';
try { transcript = fs.readFileSync(input.transcript_path, 'utf8'); } catch { process.exit(0); }
const loaded = transcript.split('\n').some((line) => {
  if (!line.includes('vs-ship-it')) return false;
  try {
    const content = JSON.parse(line)?.message?.content;
    return Array.isArray(content) && content.some((c) => c.type === 'tool_use' &&
      ((c.name === 'Skill' && /vs-ship-it/.test(c.input?.skill ?? c.input?.command ?? '')) ||
       (c.name === 'Read' && /vs-ship-it\/SKILL\.md$/.test(c.input?.file_path ?? ''))));
  } catch { return false; }
});
if (loaded) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'PR creation goes through the vs-ship-it skill in this repo. Load it with the Skill tool (skill: "vs-ship-it") and follow its PR workflow; it reuses the branch and push you already made.',
  },
}));
