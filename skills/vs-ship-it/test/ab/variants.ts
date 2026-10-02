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

export interface Variant {
  id: string;
  summary: string;
  edits: SkillEdit[];
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
