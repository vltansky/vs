import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SHARED_DIR = path.resolve(__dirname, '..');
const GOALS = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'codex-goal.md'),
  'utf8',
);
const SUBAGENTS = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'subagents.md'),
  'utf8',
);
const INDEPENDENT_ADVISORS = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'independent-advisors.md'),
  'utf8',
);
const PUSHBACK = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-pushback', 'SKILL.md'),
  'utf8',
);
const BUILD_IT = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-build-it', 'SKILL.md'),
  'utf8',
);
const BUILD_HANDOFF = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-build-it', 'references', 'handoff.md'),
  'utf8',
);
const ROAST_REVIEW = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-roast-code', 'SKILL.md'),
  'utf8',
);
const BUGFIX = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-bugfix', 'SKILL.md'),
  'utf8',
);
const RFC_RESEARCH = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-rfc-research', 'SKILL.md'),
  'utf8',
);
const IMPROVE = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-improve', 'SKILL.md'),
  'utf8',
);
const README = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', '..', 'README.md'),
  'utf8',
);
const PLUGIN = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', '..', '.claude-plugin', 'plugin.json'),
  'utf8',
);

describe('Codex goal ownership', () => {
  it('requires explicit user authorization before creating a goal', () => {
    expect(GOALS).toMatch(/Goal-tool availability is not\s+authorization/);
    expect(GOALS).toMatch(/explicitly asks.*Codex goal/is);
  });

  it('keeps goal mutation with the parent workflow', () => {
    expect(GOALS).toMatch(
      /Subagents do not create,\s+complete, or block goals/,
    );
    expect(GOALS).toMatch(/parent workflow owns goal state/);
  });
});

describe('subagent budget', () => {
  it('sets effort-based fanout and fresh-context defaults', () => {
    expect(SUBAGENTS).toMatch(/quick.*zero child runs/is);
    expect(SUBAGENTS).toMatch(/standard.*one active child.*two total/is);
    expect(SUBAGENTS).toMatch(/deep.*two active children.*four total/is);
    expect(SUBAGENTS).toMatch(/fresh context/);
    expect(SUBAGENTS).toMatch(/checkpoint at 40/is);
    expect(SUBAGENTS).toMatch(/stop at 60/is);
    expect(SUBAGENTS).toMatch(/stop-and-return limits/is);
    expect(SUBAGENTS).toMatch(/Do not fork the full parent transcript/is);
    expect(SUBAGENTS).toMatch(/fork_turns: "all"/);
    expect(SUBAGENTS).toMatch(
      /do\s+not call `wait_agent`\s+again immediately/is,
    );
  });

  it('makes incomplete child waits actionable without busy polling', () => {
    expect(SUBAGENTS).toMatch(
      /times out or returns while the child is still running/is,
    );
    expect(SUBAGENTS).toMatch(
      /continue useful non-overlapping parent\s+work/is,
    );
    expect(SUBAGENTS).toMatch(/one longer event-aware wait/is);
    expect(SUBAGENTS).toMatch(/next phase gate/is);
  });

  it('counts model-backed advisors and requires deterministic evidence first', () => {
    expect(SUBAGENTS).toMatch(/model-backed advisor, reviewer, or CLI session/is);
    expect(SUBAGENTS).toMatch(/counts toward the same child\s+budget/is);
    expect(SUBAGENTS).toMatch(/deterministic.*before delegating/is);
  });

  it('is applied by build and review workflows', () => {
    expect(BUILD_IT).toContain(
      '../vs-internal-shared/references/subagents.md',
    );
    expect(ROAST_REVIEW).toContain(
      '../vs-internal-shared/references/subagents.md',
    );
    expect(ROAST_REVIEW).not.toMatch(/Run 3 agents in parallel/);
    expect(ROAST_REVIEW).not.toMatch(/Two agents in parallel/);
  });

  it('does not let improve loosen the shared effort budget', () => {
    expect(IMPROVE).toMatch(/quick[\s\S]*?\| 0 \|/i);
    expect(IMPROVE).toMatch(/standard[\s\S]*?one active, two total/is);
    expect(IMPROVE).toMatch(/deep[\s\S]*?two active, four total/is);
    expect(IMPROVE).not.toMatch(/≤8 total/);
    expect(IMPROVE).toMatch(/execute.*standard budget.*first child slot/is);
  });

  it('keeps expensive review and QA conditional in build workflows', () => {
    expect(BUILD_IT).not.toMatch(/Pipeline review while executing/);
    expect(BUILD_IT).toMatch(/Load.*debug-mode.*only after/is);
    expect(BUILD_IT).toMatch(/user-visible.*browser behavior/is);
    expect(BUILD_IT).toMatch(/small, low-risk diff.*parent/is);
    expect(BUILD_HANDOFF).toMatch(/vs-brief\/SKILL\.md.*when the change/is);
  });

  it('defers phase-heavy context and ends the implementation phase cleanly', () => {
    expect(BUILD_IT).toMatch(/routing metadata, not a preload list/is);
    expect(BUILD_IT).toMatch(/only when its phase gate fires/is);
    expect(BUILD_IT).toMatch(/pass disk-backed evidence paths/is);
    expect(BUILD_IT).toMatch(
      /once the Build It handoff is sent, implementation is\s+complete/is,
    );
    expect(BUILD_IT).toMatch(
      /do\s+not keep an implementation transcript alive for sustained monitoring/is,
    );
  });

  it('gates bugfix stress testing and cross-model review by risk', () => {
    expect(BUGFIX).toContain('../vs-internal-shared/references/subagents.md');
    expect(BUGFIX).toMatch(/stress-test subagent only when/is);
    expect(BUGFIX).not.toMatch(/Pass 2 \(Roast \+ Codex\): 2 agents/);
  });

  it('batches RFC evidence and passes the draft by path', () => {
    expect(RFC_RESEARCH).toContain(
      '../vs-internal-shared/references/subagents.md',
    );
    expect(RFC_RESEARCH).toMatch(/one Explore child per evidence domain/is);
    expect(RFC_RESEARCH).toMatch(/reserve one child slot for Phase 5/is);
    expect(RFC_RESEARCH).toMatch(/draft\s+file path.*do not paste/is);
    expect(RFC_RESEARCH).toMatch(/independent-advisors.*budget remains/is);
  });

  it('gates cross-model review instead of running it unconditionally', () => {
    expect(ROAST_REVIEW).toMatch(/Run the advisor lane when either trigger fires/is);
    expect(ROAST_REVIEW).toMatch(/Skip it for SMALL unless the user asked/);
    expect(ROAST_REVIEW).toMatch(/Parent Roast \+ Gated Codex Review/);
    expect(ROAST_REVIEW).not.toMatch(/Always try to run Codex review/);
  });

  it('spends the advisor lane exactly when a clean self-review needs it', () => {
    expect(ROAST_REVIEW).toMatch(
      /A clean parent pass on a STANDARD change\*\* — the parent roast confirmed\s+nothing/,
    );
    expect(ROAST_REVIEW).toMatch(
      /A clean parent pass is a\s+reason to get a second opinion, not a reason to skip one/,
    );
  });

  it('derives the advisor scope from the selected review scope without probing', () => {
    expect(ROAST_REVIEW).toMatch(
      /\*\*Derive the advisor scope from the Phase 0 selection — never from global git\s+state and never by probing\.\*\*/,
    );
    expect(ROAST_REVIEW).toMatch(/case "\$REVIEW_SCOPE_KIND" in/);
    expect(ROAST_REVIEW).toMatch(/explicit-uncommitted\|staged/);
    expect(ROAST_REVIEW).toMatch(/explicit-branch\|branch/);
    expect(ROAST_REVIEW).not.toMatch(/git status --porcelain --untracked-files=no/);
    expect(ROAST_REVIEW).toMatch(
      /timeout 120 codex review "\$\{CODEX_SCOPE_ARGS\[@\]\}"/,
    );
    expect(ROAST_REVIEW).toMatch(/`timeout 120` is the whole retry policy/);
    expect(ROAST_REVIEW).toMatch(
      /Running `codex review --help`,\s+retrying another flag on empty output, or polling a backgrounded review with\s+`sleep` is wasted budget/,
    );
  });

  it('weakens the verdict when the advisor lane did not run', () => {
    expect(ROAST_REVIEW).toMatch(/\*\*Missing-lane rule\.\*\*/);
    expect(ROAST_REVIEW).toMatch(/Lanes: codex ✗ \(timeout\)/);
    expect(ROAST_REVIEW).toMatch(
      /reviewed, not independently verified — human\s+review required/,
    );
    expect(ROAST_REVIEW).toMatch(/Never `Remaining: 0` on its own/);
    expect(ROAST_REVIEW).toMatch(/Lanes: codex ✓/);
    expect(ROAST_REVIEW).toMatch(/`Lanes` is mandatory/);
  });

  it('re-runs the advisor only when a serious finding was fixed', () => {
    expect(ROAST_REVIEW).toMatch(
      /\*\*Re-review only when it earned a re-run\.\*\*/,
    );
    expect(ROAST_REVIEW).toMatch(
      /re-run the advisor only\s+if a CAPITAL OFFENSE or FELONY was fixed/,
    );
  });
});

describe('independent advisor fanout', () => {
  it('keeps one public pushback intent and an internal reusable contract', () => {
    expect(
      fs.existsSync(path.resolve(SHARED_DIR, '..', 'vs-second-opinion')),
    ).toBe(false);
    expect(PUSHBACK).toContain(
      '../vs-internal-shared/references/independent-advisors.md',
    );
    expect(ROAST_REVIEW).toContain(
      '../vs-internal-shared/references/independent-advisors.md',
    );
    expect(RFC_RESEARCH).toContain(
      '../vs-internal-shared/references/independent-advisors.md',
    );
    expect(README).not.toContain('/vs-second-opinion');
    expect(PLUGIN).not.toContain('./skills/vs-second-opinion');
  });

  it('risk-gates model diversity without delaying the first round', () => {
    expect(INDEPENDENT_ADVISORS).toMatch(/substantial.*one advisor/is);
    expect(INDEPENDENT_ADVISORS).toMatch(
      /high-risk or disputed.*two advisors/is,
    );
    expect(INDEPENDENT_ADVISORS).toMatch(/different model family/is);
    expect(INDEPENDENT_ADVISORS).toMatch(/45-second deadline/i);
    expect(INDEPENDENT_ADVISORS).toMatch(/never delay Round 1/i);
    expect(INDEPENDENT_ADVISORS).toMatch(/discard.*late/is);
  });

  it('treats advisor output as bounded evidence instead of votes', () => {
    expect(INDEPENDENT_ADVISORS).toMatch(/top three falsifiable objections/i);
    expect(INDEPENDENT_ADVISORS).toMatch(/minimal redacted context/i);
    expect(INDEPENDENT_ADVISORS).toMatch(/skip and disclose/i);
    expect(INDEPENDENT_ADVISORS).toMatch(/do not majority-vote/i);
  });

  it('dispatches during pushback pre-scan and collects before the verdict', () => {
    expect(PUSHBACK).toMatch(/dispatch.*during pre-scan/is);
    expect(PUSHBACK).toMatch(/collect.*before the verdict/is);
  });
});
