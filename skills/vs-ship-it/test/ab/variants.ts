// Candidate SKILL.md edits for the ship-it cost A/B eval. Each variant is a list
// of anchored text edits applied to a staged copy of the skills; an anchor that
// no longer exists throws, so a drifted skill fails the run instead of silently
// measuring the baseline under a variant's name.

export interface SkillEdit {
  skill: string;
  anchor: string;
  /** Text inserted after the anchor, or the anchor's replacement when `replace` is set. */
  text: string;
  replace?: boolean;
}

export interface SkillMove {
  skill: string;
  /** Span start anchor (inclusive) and end anchor (exclusive), searched after the start. */
  start: string;
  end: string;
  /** Skill-relative reference path; spans sharing a path are appended in order. */
  ref: string;
  /** Text left in place of the span. */
  stub: string;
}

export interface Variant {
  id: string;
  summary: string;
  edits: SkillEdit[];
  /** Spans moved out of SKILL.md into on-demand reference files (progressive disclosure). */
  moves?: SkillMove[];
  /** Extra files staged into every skills root: skills-relative destination -> source path under test/ab. */
  files?: Record<string, string>;
  /** Files staged into the workspace root (e.g. project hooks): workspace-relative destination -> source under test/ab. */
  workspaceFiles?: Record<string, string>;
  /** Written as the workspace's .claude/settings.json (Claude Code only). */
  claudeSettings?: object;
}

const WATCHER_CHILD: SkillEdit = {
  skill: 'vs-baby-sit',
  anchor: `### Codex fresh-context watcher

For Codex, silence inside the process is not enough: every model-level resume
can still re-read the surrounding conversation. Isolate sustained waiting from
implementation history:`,
  replace: true,
  text: `### Fresh-context watcher

Silence inside the process is not enough: every model-level resume can still
re-read the surrounding conversation. This applies to Codex and Claude Code
alike. Isolate sustained waiting from implementation history:`,
};

const WATCHER_CHILD_CLAUDE: SkillEdit = {
  skill: 'vs-baby-sit',
  anchor: `   model or inherit the current model. Escalate difficult diagnosis or code
   changes back to the owning task after an attention event.`,
  text: `
   In Claude Code, use the Agent tool with \`subagent_type: "general-purpose"\`
   (never a fork, which copies the transcript), \`model: "haiku"\`, and
   \`run_in_background: false\`, so the parent makes no model calls while the
   child waits. The child runs the watcher through Bash with
   \`timeout: 600000\` and re-runs it on a 10-minute timeout until it exits.`,
};

const PUBLISHER_CHILD: SkillEdit = {
  skill: 'vs-ship-it',
  anchor: `Babysitting is the default after PR verification unless the user opts out.
`,
  text: `
### Fresh-context publisher

Publishing re-reads the whole conversation on every model call, and
babysitting adds one call per watcher resume. When the current task already
holds substantial implementation, debugging, or large file reads, finish Step 1
here (scoped commit, branch, push), then delegate Steps 2-5 and babysitting to
one fresh-context child and wait for it once:

- Codex: \`spawn_agent\` with \`fork_turns: "none"\`, then a single \`wait_agent\`.
- Claude Code: the Agent tool with \`subagent_type: "general-purpose"\` (never a
  fork) and \`run_in_background: false\`.

Give the child a compact brief instead of the transcript: repository, base and
head branch, pushed head SHA, the user's request, the problem and fix in two or
three sentences, Before/After behavior, validation commands with their results,
and the explicit-opt-out state for walkthrough and watching. Tell it to load
\`vs-ship-it\` and follow Steps 2-5 and the Handoff exactly, then return the
Handoff verbatim. Relay that Handoff to the user unchanged. Do not re-verify
what the child verified. If the brief cannot state the change without the
transcript, publish here instead.
`,
};

// Shipped in vs-ship-it SKILL.md after Claude Code skipped babysitting in 2/2 baseline runs.
const CONTINUE_TO_BABYSIT: SkillEdit = {
  skill: 'vs-ship-it',
  anchor: `Do not describe CI, deployment, preview behavior, or production as verified when
only PR creation succeeded.
`,
  text: `
The creation handoff is a progress message, not the end of the turn. Unless
the user explicitly opted out of watching, load \`vs-baby-sit\` and start it in
the same turn right after printing the handoff. Ending the turn with "Next: hand
off to vs-baby-sit" or an offer to watch is a skipped phase, not a handoff.
`,
};

const PUBLISH_SCRIPT: SkillEdit = {
  skill: 'vs-ship-it',
  anchor: `### Step 4: Create and verify the PR
`,
  text: `
Run the gate, creation, and verification as one call after the branch is pushed
and the body file is written:

\`\`\`bash
node <skill-dir>/scripts/publish-pr.mjs --title "<title>" --body-file "$BODY_FILE" --base <base>
\`\`\`

It prints one JSON line. Exit 0 means the PR is open, non-draft, on this branch,
at the pushed head; use its \`url\`, \`head\`, and \`walkthrough\` fields and skip
the manual gate, create, and verify commands. Exit 1 carries the gate report: fix
the body and rerun. Exit 2 names the missing push or branch. Exit 3 is an
association mismatch: report it and stop. Use the manual commands below only
when the script is unavailable.
`,
};

const SLIM_MOVES: SkillMove[] = [
  {
    skill: 'vs-ship-it',
    start: '### Endpoint and schema proof\n',
    end: '### Step 3: Prepare screenshots and video\n',
    ref: 'references/contract-proof.md',
    stub: `### Endpoint, schema, and prototype proof

When the diff changes a handler, route, resolver, RPC, migration, SQL, or wire
schema, or the proof is an HTML prototype or demo, load
[\`references/contract-proof.md\`](references/contract-proof.md) before writing
the body. Otherwise skip it; \`pr-media-gate.mjs\` names a missing Endpoint or
Schema block.

`,
  },
  {
    skill: 'vs-ship-it',
    start: 'Before creating the PR, inspect the current session and known build/QA artifacts\n',
    end: 'Then run the proof gate on the body file.',
    ref: 'references/media.md',
    stub: `When the diff changes UI or visible behavior, or valid session or QA media
already exists, load [\`references/media.md\`](references/media.md) and follow it
to capture and upload matched screenshots or video before writing the final
body. Otherwise there is nothing to capture.

`,
  },
  {
    skill: 'vs-ship-it',
    start: "Keep each clip's scenario, viewport/fixture, recorded revision, and uploaded URL\n",
    end: '### Step 4: Create and verify the PR\n',
    ref: 'references/media.md',
    stub: '',
  },
  {
    skill: 'vs-ship-it',
    start: '- 10 or more changed files: load and follow\n',
    end: 'When the composed babysitter reaches',
    ref: 'references/large-pr-walkthrough.md',
    stub: `- 10 or more changed files: load and follow
  [\`references/large-pr-walkthrough.md\`](references/large-pr-walkthrough.md).

Then hand the verified PR to \`vs-baby-sit\` immediately.

`,
  },
];

// Routing: on "create pr" after a long fix turn, Claude sometimes pushes and runs
// `gh pr create` without loading the skill (4/20 full-mode trials, 0/8 light).
const DESCRIPTION_ROUTING: SkillEdit = {
  skill: 'vs-ship-it',
  anchor: 'description: "Use vs-ship-it when',
  replace: true,
  text: 'description: "Load vs-ship-it before running git push or gh pr create for the user. Use vs-ship-it when',
};

// 4/12 round-7 trials skipped babysitting with an invented opt-out ("no CI
// configured", "sandbox remote") although the skill only allows an explicit one.
const NO_INFERRED_OPT_OUT: SkillEdit = {
  skill: 'vs-ship-it',
  anchor: `off to vs-baby-sit" or an offer to watch is a skipped phase, not a handoff.
`,
  text: `No CI workflow in the tree, a small PR, an unfamiliar or sandbox-looking
remote, and passing local tests are not opt-outs: \`vs-baby-sit\` reads the
checks and reviews GitHub reports for the exact head and decides from those.
`,
};

export const VARIANTS: Variant[] = [
  { id: 'v0-baseline', summary: 'Current skills, unchanged.', edits: [] },
  {
    id: 'v1-watcher-child',
    summary: 'Host-neutral fresh-context watcher; Claude Code uses a blocking haiku general-purpose child.',
    edits: [WATCHER_CHILD, WATCHER_CHILD_CLAUDE],
  },
  {
    id: 'v2-publisher-child',
    summary: 'Ship-it delegates Steps 2-5 plus babysitting to one fresh-context child after pushing.',
    edits: [PUBLISHER_CHILD],
  },
  {
    id: 'v3-both',
    summary: 'Publisher child plus fresh-context watcher guidance.',
    edits: [PUBLISHER_CHILD, WATCHER_CHILD, WATCHER_CHILD_CLAUDE],
  },
  {
    id: 'v4-continue',
    summary: 'Ship-it states the creation handoff does not end the turn; babysitting starts in the same turn.',
    edits: [CONTINUE_TO_BABYSIT],
  },
  {
    id: 'v5-continue-watcher',
    summary: 'v4 plus the fresh-context watcher child.',
    edits: [CONTINUE_TO_BABYSIT, WATCHER_CHILD, WATCHER_CHILD_CLAUDE],
  },
  {
    id: 'v6-publish-script',
    summary: 'One script call runs the media gate, creates the PR, and verifies it.',
    edits: [PUBLISH_SCRIPT],
    files: { 'vs-ship-it/scripts/publish-pr.mjs': 'candidates/publish-pr.mjs' },
  },
  {
    id: 'v7-slim',
    summary: 'Media capture/upload, endpoint/schema/prototype proof, and the large-PR walkthrough move to on-demand references.',
    edits: [],
    moves: SLIM_MOVES,
  },
  {
    id: 'v8-description',
    summary: 'Description leads with "load before git push or gh pr create".',
    edits: [DESCRIPTION_ROUTING],
  },
  {
    id: 'v10-no-inferred-optout',
    summary: 'Ship-it names missing CI, small PRs, and sandbox remotes as non-opt-outs for babysitting.',
    edits: [NO_INFERRED_OPT_OUT],
  },
  {
    id: 'v9-guard-hook',
    summary: 'PreToolUse hook denies `gh pr create` until vs-ship-it is loaded in the session.',
    edits: [],
    workspaceFiles: { '.claude/hooks/ship-it-guard.mjs': 'candidates/ship-it-guard.mjs' },
    claudeSettings: {
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/ship-it-guard.mjs"', timeout: 5 }],
        }],
      },
    },
  },
];

export function applyEdits(skill: string, source: string, edits: SkillEdit[]): string {
  let out = source;
  for (const edit of edits.filter((e) => e.skill === skill)) {
    // An edit that already shipped (e.g. CONTINUE_TO_BABYSIT) is part of the baseline now.
    if (!edit.replace && out.includes(edit.text.trim())) continue;
    const at = out.indexOf(edit.anchor);
    if (at < 0) throw new Error(`variant anchor missing in ${skill}/SKILL.md: ${edit.anchor.slice(0, 60)}`);
    out = edit.replace
      ? out.slice(0, at) + edit.text + out.slice(at + edit.anchor.length)
      : out.slice(0, at + edit.anchor.length) + edit.text + out.slice(at + edit.anchor.length);
  }
  return out;
}

export function applyMoves(skill: string, source: string, moves: SkillMove[]): { md: string; refs: Map<string, string> } {
  let md = source;
  const refs = new Map<string, string>();
  for (const move of moves.filter((m) => m.skill === skill)) {
    const at = md.indexOf(move.start);
    const end = at < 0 ? -1 : md.indexOf(move.end, at + move.start.length);
    if (at < 0 || end < 0) throw new Error(`variant move anchor missing in ${skill}/SKILL.md: ${(at < 0 ? move.start : move.end).slice(0, 60)}`);
    refs.set(move.ref, `${refs.get(move.ref) ?? ''}${md.slice(at, end)}`);
    md = md.slice(0, at) + move.stub + md.slice(end);
  }
  return { md, refs };
}
