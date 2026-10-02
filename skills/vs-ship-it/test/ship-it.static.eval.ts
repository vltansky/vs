import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '..', 'agents', 'openai.yaml'),
  'utf8',
);
const README = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'README.md'),
  'utf8',
);
const DESCRIPTION = SKILL.match(/^description: "([^"]+)"$/m)?.[1] ?? '';
const PR_WORKFLOW = SKILL.split('## PR workflow')[1]?.split('## Handoff')[0] ?? '';

describe('vs-ship-it routing', () => {
  it('owns affirmative PR publishing requests', () => {
    expect(DESCRIPTION).toMatch(
      /^Use vs-ship-it when the user asks to create or open a PR/i,
    );
    expect(DESCRIPTION).toMatch(/says create PR, open PR, or ship it/i);
    expect(DESCRIPTION).toMatch(/affirmative publish intent/i);
    expect(DESCRIPTION).toMatch(/review\/readiness-only requests/i);
    expect(DESCRIPTION.indexOf('create or open a PR')).toBeLessThan(
      DESCRIPTION.indexOf('review'),
    );
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('wins over generic publishers without composing them', () => {
    expect(DESCRIPTION).toMatch(/github:yeet/i);
    expect(SKILL).toMatch(/Prefer this workflow over a\s+generic publisher/);
    expect(SKILL).toMatch(/do not compose two publishers/i);
  });

  it('keeps explicit direct pushes separate', () => {
    expect(SKILL).toContain('### Direct-push path');
    expect(SKILL).toMatch(/verify local and remote SHAs match/i);
    expect(SKILL).toContain('Do not create a feature branch or PR in direct-push mode.');
    expect(SKILL).toMatch(/Direct-push mode does\s+not start `vs-pr-walkthrough` or `vs-baby-sit`/i);
  });

  it('routes bare ship-it to the single PR workflow', () => {
    expect(SKILL).toMatch(/says bare `ship it` without naming a push destination/);
    expect(SKILL).toContain('## PR workflow');
    expect(SKILL).not.toContain('Immediate PR path');
    expect(SKILL).not.toContain('Mechanical PR fast path');
  });
});

describe('vs-ship-it publishing boundary', () => {
  it('does not include a pre-PR code-review phase', () => {
    expect(PR_WORKFLOW).toMatch(/five outcomes: prepare the PR description/i);
    expect(PR_WORKFLOW).toMatch(/Code\s+review is outside this workflow/i);
    expect(SKILL).not.toContain('Offer review without blocking');
    expect(SKILL).not.toContain('vs-roast-code');
    expect(SKILL).not.toMatch(/Review: <reused \| ran with approval \| skipped/);
  });

  it('shows the PR format and available proof in the README flow', () => {
    expect(README).not.toContain('Review explicitly approved?');
    expect(README).toMatch(/Prepare PR description<br\/>feature_area: title/);
    expect(README).toMatch(/Problem scenario \(STE100\) \+ Endpoint\/Schema\/UI proof<br\/>Why this change/);
    expect(README).toMatch(/Merge risk \(Door \/ Blast\)<br\/>Surfaces<br\/>Problem scenario \(STE100\) \+ Endpoint\/Schema\/UI proof<br\/>Why this change<br\/>User impact<br\/>Evidence \+ gaps<br\/>Review focus/);
    expect(README).toMatch(/Reuse or capture proof<br\/>matched Before\/After screenshots/);
    expect(README).toMatch(/short video for interactions/);
  });
});

describe('vs-ship-it independent PR preparation', () => {
  it('prepares reviewer-facing copy without asking for wording approval', () => {
    expect(PR_WORKFLOW).toMatch(/Write the description directly from the live conversation/i);
    expect(PR_WORKFLOW).toMatch(/Do not ask the user to write or approve PR\s+copy/i);
    expect(PR_WORKFLOW).toContain('## Merge risk');
    expect(PR_WORKFLOW).toContain('## Surfaces');
    expect(PR_WORKFLOW).toContain('## What Problem This Solves');
    expect(PR_WORKFLOW).toContain('## Why This Change Was Made');
    expect(PR_WORKFLOW).toContain('## User Impact');
    expect(PR_WORKFLOW).toContain('## Evidence');
    expect(PR_WORKFLOW).toContain('## Review focus');
  });

  it('does not make ceremony part of default PR creation', () => {
    expect(PR_WORKFLOW).toMatch(/Do not add brief generation, broad\s+verification, reviewer discovery, or broad QA unless the user explicitly\s+requested/i);
    expect(PR_WORKFLOW).toMatch(
      /do not introduce `vs-before-after`, `vs-verify`/i,
    );
    expect(PR_WORKFLOW).toMatch(/Do not suggest reviewers or run broad QA by default/i);
  });

  it('uses body files for create and edit', () => {
    expect(PR_WORKFLOW).toContain(
      'gh pr create --title "<title>" --body-file "$BODY_FILE"',
    );
    expect(PR_WORKFLOW).toMatch(/never pass[\s\S]*inline `--body`/i);
    expect(PR_WORKFLOW).toContain('gh pr edit --body-file');
  });
});

describe('vs-ship-it before and after', () => {
  it('requires a concrete comparison even for new and internal changes', () => {
    expect(PR_WORKFLOW).toMatch(/Every PR description must include.*Before.*After/i);
    expect(PR_WORKFLOW).toMatch(/same actor, input, and precondition/i);
    expect(PR_WORKFLOW).toMatch(/new feature[\s\S]*previous absence/i);
    expect(PR_WORKFLOW).toMatch(/internal[\s\S]*unchanged/i);
    expect(PR_WORKFLOW).not.toMatch(/omit Before\/After/);
    expect(PR_WORKFLOW).toMatch(/Source-derived/);
  });

  it('makes the difference visible and captures missing frontend evidence', () => {
    expect(PR_WORKFLOW).toMatch(/comparison table/);
    expect(PR_WORKFLOW).toMatch(/Mermaid/);
    expect(PR_WORKFLOW).toMatch(/For frontend changes, capture missing/i);
    expect(PR_WORKFLOW).toMatch(/same route, data, viewport, and interaction/);
    expect(PR_WORKFLOW).toMatch(/caption.*what to notice/i);
    expect(PR_WORKFLOW).not.toMatch(/Ask the user first — recording/);
  });
});

describe('vs-ship-it visual PR description', () => {
  it('leads with proof shaped by what changed', () => {
    expect(PR_WORKFLOW).toMatch(/Make the description visual first/);
    expect(PR_WORKFLOW).toMatch(/Paired output blocks copied verbatim from the same input/);
    expect(PR_WORKFLOW).toMatch(/both operands beside any derived figure/);
    expect(PR_WORKFLOW).toMatch(/fenced `mermaid` diagram of the changed path/);
    expect(PR_WORKFLOW).toMatch(/fenced `diff` block of the key hunk/);
    expect(PR_WORKFLOW).toContain('```mermaid');
    expect(PR_WORKFLOW).toContain('```diff');
    expect(PR_WORKFLOW).toMatch(/\| \| Before \| After \|/);
    expect(PR_WORKFLOW).toContain('<details><summary>');
    expect(PR_WORKFLOW).toMatch(/Never paste the whole diff/);
    expect(PR_WORKFLOW).toMatch(/Drop any template row, block, or section the evidence does not fill/);
  });

  it('borrows the explaining skills inline instead of composing them', () => {
    expect(PR_WORKFLOW).toMatch(/apply it inline;\s+do not\s+spawn them as shipping phases/i);
    expect(PR_WORKFLOW).toMatch(/observed, tested, or source-derived/);
    expect(PR_WORKFLOW).toMatch(/no metric or\s+status the evidence does not contain/i);
    expect(PR_WORKFLOW).toMatch(/one familiar analogy mapped to the real parts/);
    expect(PR_WORKFLOW).toContain('gh api repos/{owner}/{repo} --jq .id');
    expect(PR_WORKFLOW).not.toContain('databaseId');
    expect(PR_WORKFLOW).toMatch(/this line is the `--title`, and the\s+body file starts at the first heading/);
  });
});

describe('vs-ship-it media preparation', () => {
  it('handles screenshots and video before PR creation', () => {
    expect(PR_WORKFLOW).toMatch(/Before creating the PR, inspect/i);
    expect(PR_WORKFLOW).toMatch(/matched screenshots for static visual states/i);
    expect(PR_WORKFLOW).toMatch(/matched recordings for motion/i);
    expect(PR_WORKFLOW).toMatch(/Insert the URLs into the body file before `gh pr create`/i);
  });

  it('does not block when media is unavailable', () => {
    expect(PR_WORKFLOW).toMatch(/If no valid media exists, continue without asking/i);
    expect(PR_WORKFLOW).toMatch(/state\s+the exact visual-proof gap\s+under Evidence/i);
    expect(PR_WORKFLOW).toMatch(/On upload failure, continue creating the PR/i);
  });

  it('uploads through GitHub user attachments', () => {
    expect(PR_WORKFLOW).toContain('https://uploads.github.com/user-attachments/assets');
    expect(PR_WORKFLOW).toContain('gh auth token');
    expect(PR_WORKFLOW).toContain('--data-binary @<absolute-file-path>');
    expect(PR_WORKFLOW).toMatch(/inherits repository\s+visibility/i);
    expect(PR_WORKFLOW).toMatch(/needs no browser, Computer Use, draft comment, or vision tool/i);
  });

  it('embeds images and video correctly', () => {
    expect(PR_WORKFLOW).toContain('image/png');
    expect(PR_WORKFLOW).toContain('video/mp4');
    expect(PR_WORKFLOW).toContain('video/webm');
    expect(PR_WORKFLOW).toContain(
      'ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4',
    );
    expect(PR_WORKFLOW).toMatch(/Embed images as `!\[concise caption\]/i);
    expect(PR_WORKFLOW).toMatch(/videos as the\s+returned URL on its own bare line/i);
    expect(PR_WORKFLOW).toMatch(/every uploaded image renders and\s+every video exposes a player/i);
  });

  it('keeps proof assets out of the product branch', () => {
    expect(PR_WORKFLOW).toMatch(/HTTP 422.*unsupported media type/i);
    expect(PR_WORKFLOW).toMatch(/HTTP 404.*bad repository ID/i);
    expect(PR_WORKFLOW).toMatch(/Never commit proof assets to the product\s+branch/i);
    expect(PR_WORKFLOW).toContain('.github/pr-assets');
  });
});

describe('vs-ship-it PR association and stopping point', () => {
  it('creates and verifies a regular PR before babysitting starts', () => {
    expect(DESCRIPTION).toMatch(/Creates and verifies regular PRs/);
    expect(PR_WORKFLOW).not.toContain('gh pr create --draft');
    expect(PR_WORKFLOW).not.toMatch(/gh pr merge --auto/);
    expect(PR_WORKFLOW).toMatch(/Do not pass `--draft`/);
    expect(PR_WORKFLOW).toContain('isDraft');
    expect(PR_WORKFLOW).toContain('.isDraft == false');
    expect(PR_WORKFLOW).not.toContain('.isDraft == true');
    expect(PR_WORKFLOW).toMatch(/babysit.*owns.*ready for review/is);
    expect(SKILL).toMatch(
      /State: open, ready for review[\s\S]*exact head[\s\S]*repair converts it to draft/i,
    );
  });

  it('verifies open state, branch, and exact head', () => {
    expect(PR_WORKFLOW).toContain(
      'gh pr view --json number,url,title,state,isDraft,headRefName,headRefOid,changedFiles',
    );
    expect(PR_WORKFLOW).toContain('.state == "OPEN"');
    expect(PR_WORKFLOW).toContain('.headRefName == $branch');
    expect(PR_WORKFLOW).toContain('.headRefOid == $head');
    expect(PR_WORKFLOW).toContain("HEAD_SHA=$(echo \"$PR_JSON\" | jq -r '.headRefOid')");
    expect(PR_WORKFLOW).toContain("CHANGED_FILES=$(echo \"$PR_JSON\" | jq -r '.changedFiles')");
    expect(PR_WORKFLOW).toMatch(/Do not switch branches before this succeeds/i);
  });

  it('starts one bounded large-PR walkthrough without delaying babysitting', () => {
    expect(PR_WORKFLOW).toMatch(/Fewer than 10 changed files[\s\S]*do not start a walkthrough child/i);
    expect(PR_WORKFLOW).toMatch(/10 or more changed files[\s\S]*vs-pr-walkthrough\/SKILL\.md/i);
    expect(PR_WORKFLOW).toMatch(/fresh-context child/i);
    expect(PR_WORKFLOW).toMatch(/hand the verified PR to\s+`vs-baby-sit`\s+immediately without waiting/i);
    expect(PR_WORKFLOW).toMatch(/exactly those two active children/i);
  });

  it('never surfaces a stale walkthrough or refreshes after every repair', () => {
    expect(PR_WORKFLOW).toMatch(/current `headRefOid`[\s\S]*walkthrough's `Explains` SHA/i);
    expect(PR_WORKFLOW).toMatch(/do not surface the stale artifact/i);
    expect(PR_WORKFLOW).toMatch(/do not regenerate after\s+each repair push/i);
    expect(PR_WORKFLOW).toMatch(/At `reason: ready-for-review`, refresh it once/i);
    expect(PR_WORKFLOW).toMatch(/one initial walkthrough and at most one final\s+refresh/i);
    expect(PR_WORKFLOW).toMatch(/Never prepare a walkthrough before the PR exists/i);
  });

  it('keeps walkthrough generation non-blocking', () => {
    expect(PR_WORKFLOW).toMatch(/A review aid never blocks publishing, repair, or the\s+`review-approval` stop/i);
    expect(SKILL).toMatch(/Walkthrough: <\[open walkthrough\][\s\S]*exact <short SHA>[\s\S]*generating for\s+exact head[\s\S]*skipped — small PR[\s\S]*exact gap>/i);
  });

  it('starts babysitting after PR verification unless declined', () => {
    expect(DESCRIPTION).toMatch(/babysits them by default/i);
    expect(SKILL).toMatch(/Hand the verified PR to `vs-baby-sit`/i);
    expect(SKILL).toMatch(/unless the user explicitly says not to watch/i);
    expect(SKILL).toMatch(/visibly separate\s+babysitting phase/i);
  });

  // A/B (ship-it-cost.ab.eval.ts): without this, Claude Code ended the turn on the
  // creation handoff with "Next: hand off to vs-baby-sit" and never watched CI.
  it('keeps the creation handoff from ending the turn', () => {
    expect(SKILL).toMatch(/creation handoff is a progress message,\s+not the end of the turn/i);
    expect(SKILL).toMatch(/start it in\s+the same turn/i);
    expect(SKILL).toMatch(/is a skipped phase,\s+not a handoff/i);
  });

  it('ends the composed workflow at a human review gate', () => {
    expect(SKILL).toMatch(/`Review needed: @<user-or-team>`/);
    expect(SKILL).toMatch(/Do\s+not resume watching because auto-merge is armed/i);
    expect(SKILL).toMatch(/require a new\s+user turn after the human review gate clears/i);
  });

  it('keeps evidence boundaries honest', () => {
    expect(SKILL).toMatch(/Do not describe CI, deployment, preview behavior, or production as verified/i);
    expect(SKILL).toMatch(/Media: <N screenshots, N videos attached/);
  });
});

describe('vs-ship-it door, blast radius, and What Problem scenario', () => {
  it('requires Door and Blast radius in the PR body template', () => {
    // The badge is the label: the template offers both door choices and a blast choice.
    expect(PR_WORKFLOW).toMatch(/badge-<one-way \| two-way>-door\.svg/);
    expect(PR_WORKFLOW).toMatch(/badge-<wide \| narrow>-blast\.svg/);
    expect(PR_WORKFLOW).toMatch(/## Merge risk/);
  });

  it('requires inline merge-risk badges that match the door and blast lines', () => {
    const assetsDir = path.resolve(__dirname, '..', 'assets');
    for (const file of [
      'badge-two-way-door.svg',
      'badge-one-way-door.svg',
      'badge-wide-blast.svg',
      'badge-narrow-blast.svg',
    ]) {
      expect(fs.existsSync(path.join(assetsDir, file))).toBe(true);
    }
    expect(
      fs.existsSync(path.resolve(__dirname, '..', 'scripts', 'generate-badges.mts')),
    ).toBe(true);

    const RAW =
      /raw\.githubusercontent\.com\/vltansky\/vs\/master\/skills\/vs-ship-it\/assets\//;
    expect(PR_WORKFLOW).toMatch(new RegExp(RAW.source + 'badge-two-way-door\\.svg'));
    expect(PR_WORKFLOW).toMatch(/badge-one-way-door\.svg/);
    expect(PR_WORKFLOW).toMatch(/badge-wide-blast\.svg/);
    expect(PR_WORKFLOW).toMatch(/badge-narrow-blast\.svg/);
    expect(PR_WORKFLOW).toMatch(/Two-way door: easy to revert/);
    expect(PR_WORKFLOW).toMatch(/One-way door: hard to reverse/);
    expect(PR_WORKFLOW).toMatch(/Wide blast radius: many consumers/);
    expect(PR_WORKFLOW).toMatch(/after the assets land on\s+`master`/i);
    expect(PR_WORKFLOW).toMatch(/Never map one-way to "safe to merge"/i);
    expect(PR_WORKFLOW).toMatch(/Blast radius\s+is a separate axis from the door/i);
    expect(PR_WORKFLOW).toMatch(/Walkthrough HTML is out of scope/i);
    expect(PR_WORKFLOW).toMatch(/embed the wide-blast\s+badge only when blast is wide/i);
    expect(PR_WORKFLOW).toMatch(/Badges\s+classify risk and are not visual proof/i);
    // The old full-width illustrations are gone; badges are single-file, theme-neutral.
    expect(PR_WORKFLOW).not.toMatch(/preset-[a-z-]+\.png/);

    // Body-template skeleton: each badge alone on its line with bullets under it, no
    // text label; wide-blast lives only in a comment so agents do not stamp it onto narrow PRs.
    const bodyTemplate =
      PR_WORKFLOW.match(/````markdown[\s\S]*?````/)?.[0] ?? '';
    expect(bodyTemplate.length).toBeGreaterThan(0);
    const templateLive = bodyTemplate.replace(/<!--[\s\S]*?-->/g, '');
    expect(templateLive).toMatch(/^<img [^>]*badge-two-way-door\.svg">\n\n-/m);
    expect(templateLive).toMatch(/^<img [^>]*badge-narrow-blast\.svg">\n\n-/m);
    expect(templateLive).not.toMatch(/\*\*Door:\*\*|\*\*Blast radius:\*\*/);
    expect(templateLive).not.toMatch(/badge-wide-blast\.svg/);
    expect(bodyTemplate).toMatch(/<!--[\s\S]*badge-wide-blast\.svg[\s\S]*-->/);
    expect(bodyTemplate).toMatch(/do not stamp wide-blast/i);
  });

  it('locks What Problem to STE100 scenario flow with no How in Why', () => {
    expect(PR_WORKFLOW).toMatch(/ASD-STE100|STE100/i);
    expect(PR_WORKFLOW).toMatch(/actor\s*→\s*attempt\s*→\s*block|actor → attempt → block/i);
    expect(PR_WORKFLOW).toMatch(/user\/admin/i);
    expect(PR_WORKFLOW).toMatch(/\bsystem\b/i);
    expect(PR_WORKFLOW).toMatch(/either is OK|either OK/i);
    expect(PR_WORKFLOW).toMatch(/No How in Why/i);
    expect(PR_WORKFLOW).toMatch(/mintable tokens/i);
    expect(PR_WORKFLOW).toMatch(/How stays in \*\*Endpoint\*\* \/ \*\*Schema\*\* \/ \*\*UI\*\*|How stays in Endpoint/i);
    expect(PR_WORKFLOW).toMatch(/not a multi-paragraph prose wall/i);
    // Template placeholder is scenario, not the old visual menu.
    const bodyTemplate = PR_WORKFLOW.match(/````markdown[\s\S]*?````/)?.[0] ?? '';
    expect(bodyTemplate).toMatch(/Short STE100 scenario/i);
    expect(bodyTemplate).not.toMatch(/single chosen visual|pseudocode,\s*call tree/i);
  });

  it('does not add a vs-pr skill or slash', () => {
    const skillsRoot = path.resolve(__dirname, '..', '..');
    expect(fs.existsSync(path.join(skillsRoot, 'vs-pr'))).toBe(false);
    expect(SKILL).not.toContain('`/vs-pr`');
    expect(SKILL).not.toMatch(/(?:^|[^-\w])\/vs-pr(?:[^-\w]|$)/);
  });
});

describe('vs-ship-it merge risk first and Surfaces proof selectors', () => {
  const bodyTemplate =
    PR_WORKFLOW.match(/````markdown[\s\S]*?````/)?.[0] ?? '';

  it('puts Merge risk (door + blast) at the top of the body template, before What Problem', () => {
    expect(bodyTemplate.length).toBeGreaterThan(0);
    const mergeAt = bodyTemplate.indexOf('## Merge risk');
    const problemAt = bodyTemplate.indexOf('## What Problem This Solves');
    const surfacesAt = bodyTemplate.indexOf('## Surfaces');
    expect(mergeAt).toBeGreaterThan(-1);
    expect(problemAt).toBeGreaterThan(-1);
    expect(surfacesAt).toBeGreaterThan(-1);
    expect(mergeAt).toBeLessThan(problemAt);
    expect(surfacesAt).toBeGreaterThan(mergeAt);
    expect(surfacesAt).toBeLessThan(problemAt);
  });

  it('locks Surfaces vocabulary to UI|Endpoint|Schema|CLI|MCP|Infra', () => {
    expect(PR_WORKFLOW).toMatch(/## Surfaces/);
    expect(PR_WORKFLOW).toMatch(/UI · Endpoint · Schema · CLI · MCP/);
    expect(PR_WORKFLOW).toMatch(/\bInfra\b/);
    // Endpoint not backend; Schema covers wire + persistence (no separate DB badge).
    expect(PR_WORKFLOW).toMatch(/Endpoint not backend/i);
    expect(PR_WORKFLOW).toMatch(/Schema[^\n]*wire[^\n]*persistence|wire \+ persistence/i);
    expect(PR_WORKFLOW).toMatch(/no separate DB/i);
    expect(PR_WORKFLOW).toMatch(/Infra only when[^\n]*solely CI\/deploy\/flags\/env/i);
    expect(PR_WORKFLOW).toMatch(/never stack[^\n]*product surface/i);
    // Wrapper precedence.
    expect(PR_WORKFLOW).toMatch(/MCP wrap of unchanged route[^\n]*MCP only/i);
    expect(PR_WORKFLOW).toMatch(/CLI shim of unchanged MCP[^\n]*CLI only/i);
  });

  it('omits Surfaces for skill-only when paths prove no product or Infra class', () => {
    expect(PR_WORKFLOW).toMatch(/Omit Surfaces when paths prove\s+no product surface/i);
    expect(PR_WORKFLOW).toMatch(/skill-only \/ docs-only/i);
    expect(PR_WORKFLOW).toMatch(/never invent a product stamp/i);
    const bodyTemplate =
      PR_WORKFLOW.match(/````markdown[\s\S]*?````/)?.[0] ?? '';
    const templateLive = bodyTemplate.replace(/<!--[\s\S]*?-->/g, '');
    // Template must not present the full vocabulary as a default selected stamp line.
    expect(templateLive).not.toMatch(/^UI · Endpoint · Schema · CLI · MCP\s*$/m);
    // Omit rule stays in the Surfaces comment / prose (chips are an example shape).
    expect(bodyTemplate).toMatch(/Omit Surfaces when paths prove no product surface/i);
  });

  it('ships door/blast plus counted Surfaces chips; Surfaces are not risk art', () => {
    const assetsDir = path.resolve(__dirname, '..', 'assets');
    const badges = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.svg')).sort();
    const doorBlast = [
      'badge-narrow-blast.svg',
      'badge-one-way-door.svg',
      'badge-two-way-door.svg',
      'badge-wide-blast.svg',
    ];
    const kinds = ['cli', 'endpoint', 'infra', 'mcp', 'schema', 'ui'];
    const surface = kinds.flatMap((kind) =>
      [1, 2, 3, 4, 5, 6].map((n) => `badge-surface-${kind}-${n}.svg`),
    );
    expect(badges).toEqual([...doorBlast, ...surface].sort());
    // Generator is the source of truth — counted surface files must exist.
    expect(
      fs.existsSync(path.resolve(__dirname, '..', 'scripts', 'generate-badges.mts')),
    ).toBe(true);
    expect(PR_WORKFLOW).toMatch(/Surfaces are proof selectors/i);
    expect(PR_WORKFLOW).toMatch(/not risk art/i);
    expect(PR_WORKFLOW).toMatch(/badge-surface-\{kind\}-\{n\}\.svg|badge-surface-<kind>-<n>\.svg|badge-surface-endpoint-\{n\}\.svg/);
    expect(PR_WORKFLOW).toMatch(/#1a7f64/);
    expect(PR_WORKFLOW).toMatch(/#8250df/);
    expect(PR_WORKFLOW).toMatch(/#0969da/);
    expect(PR_WORKFLOW).toMatch(/#57606a/);
    expect(PR_WORKFLOW).toMatch(/#0e8a7d/);
    expect(PR_WORKFLOW).toMatch(/#c2530a/);
    expect(PR_WORKFLOW).toMatch(/Never invent backend\/DB surface names/i);
    expect(PR_WORKFLOW).not.toMatch(/badge-(?:backend|db)(?:-\d+)?\.svg/i);
    // Optional CLI/MCP proof blocks stay Later — do not implement in this cut.
    expect(PR_WORKFLOW).not.toMatch(/\*\*CLI\*\*[^\n]*```/);
    expect(PR_WORKFLOW).not.toMatch(/\*\*MCP\*\*[^\n]*```/);
  });

  it('locks Surfaces to one-line chips then deployable-module bullets', () => {
    const bodyTemplate =
      PR_WORKFLOW.match(/````markdown[\s\S]*?````/)?.[0] ?? '';
    const templateLive = bodyTemplate.replace(/<!--[\s\S]*?-->/g, '');
    expect(templateLive).toMatch(
      /badge-surface-endpoint-\d+\.svg"> <img [^>]*badge-surface-schema-\d+\.svg"> <img [^>]*badge-surface-ui-\d+\.svg"/,
    );
    expect(templateLive).toMatch(/- \*\*<Deployable module>\*\*/);
    expect(PR_WORKFLOW).toMatch(/ONE line/i);
    expect(PR_WORKFLOW).toMatch(/deployable module/i);
    expect(PR_WORKFLOW).toMatch(/Count on chip/i);
    expect(PR_WORKFLOW).toMatch(/No separate[\s\S]*Affected modules|no separate Affected modules/i);
    expect(PR_WORKFLOW).toMatch(/Door\/Blast own risk|Door and Blast own/i);
    expect(PR_WORKFLOW).toMatch(/bullets[\s\S]*not a prose wall|Badge alone on its line; bullets/i);
  });
});

describe('vs-ship-it build-when-empty compose', () => {
  it('runs build-it first when nothing is built yet, then resumes ship-it', () => {
    expect(SKILL).toMatch(/no scoped changes to publish/i);
    expect(SKILL).toMatch(/nothing new vs (?:the )?base|commits ahead of the default/i);
    expect(SKILL).toMatch(/do \*\*not\*\* create an empty PR|do not create an empty PR/i);
    expect(SKILL).toMatch(/do \*\*not\*\* stop with only ["']?nothing to ship|do not stop with only ["']?nothing to ship/i);
    expect(SKILL).toMatch(/running build-it first|run(?:ning)? build-it first/i);
    expect(SKILL).toMatch(/Read and follow[`\s\/]*`?vs-build-it`?/i);
    expect(SKILL).toMatch(/resume ship-it/i);
  });

  it('asks once when there is no buildable intent, and does not invent scope', () => {
    expect(SKILL).toMatch(/buildable intent/i);
    expect(SKILL).toMatch(/ask once what to build/i);
    expect(SKILL).toMatch(/do not invent scope/i);
  });

  it('skips the empty-tree gate inside a build-it→ship-it handoff', () => {
    expect(SKILL).toMatch(/Do not recurse/i);
    expect(SKILL).toMatch(/already inside a build-it.?ship-it handoff/i);
  });

  it('applies the gate before Direct-push and the PR workflow', () => {
    const gateAt = SKILL.search(/## Nothing built yet/);
    const chooseAt = SKILL.indexOf('## Choose the outcome');
    const directAt = SKILL.indexOf('### Direct-push path');
    const prAt = SKILL.indexOf('## PR workflow');
    expect(gateAt).toBeGreaterThan(-1);
    expect(chooseAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(chooseAt);
    expect(gateAt).toBeLessThan(directAt);
    expect(gateAt).toBeLessThan(prAt);
  });

  it('composes direct-push empty trees only when a destination was named', () => {
    expect(SKILL).toMatch(/Direct-push with an empty tree/i);
    expect(SKILL).toMatch(/only if (?:the )?user named a destination/i);
    expect(SKILL).toMatch(/prefer (?:the )?PR path after build/i);
  });

  it('covers skill-only and docs-only planned work that is not implemented yet', () => {
    expect(SKILL).toMatch(/skill-only \/ docs-only/i);
    expect(SKILL).toMatch(/planned skill change|not implemented yet/i);
  });
});

describe('vs-ship-it What Problem Why-block gate (fixtures)', () => {
  /** Score a Why / What-problem block: null = pass, string = fail reason. */
  function whyGateFailure(why: string): string | null {
    const trimmed = why.trim();
    if (!trimmed) return 'empty Why';

    // Multi-paragraph / multi-line wall (blank-line blocks OR 2+ non-empty lines).
    const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (paragraphs.length > 1 || lines.length > 1) return 'multi-paragraph prose wall';

    const howKeywords: Array<[RegExp, string]> = [
      // Domain-agnostic How shapes (catch generic mechanism leakage).
      [/\bthis PR adds\b/i, 'this PR adds'],
      [/\bwe introduce\b/i, 'we introduce'],
      [/\bnew (?:HTTPS )?endpoint\b/i, 'new endpoint'],
      [/\bnew (?:HTTPS )?route/i, 'new route as solution'],
      [/\b(?:Hosting\s+)?rewrite\b/i, 'rewrite as solution'],
      [/\b(?:Firestore\s+)?collections?\b/i, 'collections as solution'],
      [/\bmigration\b/i, 'migration as solution'],
      // Exemplar-only (playground / token domain) — same How smell, product-local words.
      [/\bmintable\b/i, 'mintable tokens'],
      [/\btoken\s+mint/i, 'token mint'],
      [/\bmint(?:able)?(?:,|\s+revocable|\s+staff|\s+tokens)/i, 'mint/tokens as solution'],
      [/\bstaffApiTokens\b/, 'staffApiTokens'],
      [/\bpiggyback(?:ing)?\s+(?:MCP\s+)?OAuth\b/i, 'OAuth piggyback as solution'],
      [/\bwithout piggybacking\b/i, 'OAuth piggyback phrasing'],
      [/\bsame JSON shape\b/i, 'JSON shape as solution'],
      [/\bAdmin-SDK-only\b/i, 'Admin-SDK-only as solution'],
    ];
    for (const [re, label] of howKeywords) {
      if (re.test(trimmed)) return `How keyword: ${label}`;
    }

    // Scenario flow must read as actor → attempt → block (always require an arrow).
    if (!/(?:→|->)/.test(trimmed)) {
      return 'missing scenario arrows';
    }

    return null;
  }

  const FAIL_HOW = `Agents cannot curl the WhatsApp Assistant Playground preview without a browser Firebase Auth session. Admins need mintable, revocable staff tokens so automation can hit a preview-only HTTPS route with the same JSON shape as the existing onCall Playground path — without piggybacking MCP OAuth or live send.`;

  const FAIL_WALL = `Agents cannot reach the preview endpoint.
Admins also need a better auth story for automation.
The platform should expose something safer than a browser session.`;

  const FAIL_ARROWLESS =
    'Agents cannot curl the Playground preview without a browser Firebase Auth session.';

  const PASS_SYSTEM =
    'Agent sends `POST /api/assistant/preview` → request fails → only a browser Firebase Auth session works.';
  const PASS_USER =
    'Admin needs an agent to call Playground preview → agent has no browser session → call is blocked.';

  it('FAILS when Why contains How keywords or is a multi-paragraph wall', () => {
    expect(whyGateFailure(FAIL_HOW)).toMatch(/How keyword|mintable/i);
    expect(whyGateFailure(FAIL_WALL)).toBe('multi-paragraph prose wall');
    expect(whyGateFailure('This PR adds staffApiTokens and a Hosting rewrite.')).toMatch(
      /How keyword/i,
    );
    expect(
      whyGateFailure(
        'We add mintable tokens so agents can call the route without piggybacking MCP OAuth.',
      ),
    ).toMatch(/How keyword/i);
    // Domain-agnostic How (not playground/token-specific).
    expect(whyGateFailure('this PR adds a new endpoint')).toMatch(/How keyword/i);
    expect(
      whyGateFailure('we introduce a rewrite / collection / migration'),
    ).toMatch(/How keyword/i);
  });

  it('FAILS when Why has no scenario arrow', () => {
    expect(whyGateFailure(FAIL_ARROWLESS)).toBe('missing scenario arrows');
    expect(
      whyGateFailure('Admin needs preview access but the agent is blocked.'),
    ).toBe('missing scenario arrows');
  });

  it('PASSES on short STE100 scenario flows (system and user/admin)', () => {
    expect(whyGateFailure(PASS_SYSTEM)).toBeNull();
    expect(whyGateFailure(PASS_USER)).toBeNull();
  });

  it('documents both perspectives as examples in the skill', () => {
    expect(PR_WORKFLOW).toMatch(/Agent sends `POST \/api\/assistant\/preview`/i);
    expect(PR_WORKFLOW).toMatch(/Admin needs an agent to call Playground preview/i);
  });
});
