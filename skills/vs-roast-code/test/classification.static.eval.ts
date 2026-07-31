import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const SIN_CATEGORIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'sin-categories.md'),
  'utf8',
);
const DESCRIPTION = SKILL.match(/^description: "([^"]+)"$/m)?.[1] ?? '';

describe('roast-code change classification', () => {
  it('advertises depth scaling in the description', () => {
    expect(DESCRIPTION).toMatch(/scales? review depth/i);
  });

  it('classifies before reviewing', () => {
    expect(SKILL).toContain('## Phase 1: Classify the Change');
    expect(SKILL.indexOf('## Phase 1: Classify the Change')).toBeLessThan(
      SKILL.indexOf('## Pass 1: Simplify'),
    );
    expect(SKILL).toMatch(/git diff --stat/);
  });

  it('defines the three classes and announces the chosen one', () => {
    for (const cls of ['SMALL', 'STANDARD', 'HIGH-RISK']) {
      expect(SKILL, `class ${cls}`).toContain(`**${cls}**`);
    }
    expect(SKILL).toMatch(/Announce the class in one line/);
  });

  it('lets risk outrank size and requires evidence to escalate', () => {
    expect(SKILL).toMatch(/\*\*Risk surface outranks size\.\*\*/);
    expect(SKILL).toMatch(/Size can only downgrade a change that touches no risk\s+surface/);
    expect(SKILL).toMatch(/\*\*Escalate on evidence, never on suspicion\.\*\*/);
    expect(SKILL).toMatch(
      /Never downgrade a depth the user explicitly asked for/,
    );
  });

  it('sniffs both additions and deletions without diff headers', () => {
    expect(SKILL).toMatch(/Sniff it deterministically on the changed lines/);
    expect(SKILL).toMatch(/rg -n '\^\[\+-\]'/);
    expect(SKILL).toMatch(/rg -v '\^\[0-9\]\+:\(\\\+\\\+\\\+\|---\) '/);
  });

  it('retains the selected scope for advisor execution', () => {
    expect(SKILL).toMatch(/Resolve the scope once and retain its exact diff arguments/);
    expect(SKILL).toContain('explicit-uncommitted');
    expect(SKILL).toContain('explicit-branch');
    expect(SKILL).toContain('explicit-file');
    expect(SKILL).toMatch(/Unrelated working-tree changes never replace the selected scope/);
    expect(SKILL).toMatch(/case "\$REVIEW_SCOPE_KIND" in/);
    expect(SKILL).not.toMatch(/git status --porcelain --untracked-files=no/);
  });

  it('keeps standard advisor execution independent of high-risk evidence capture', () => {
    expect(SKILL).toMatch(/if \[ "\$REVIEW_CLASS" = "HIGH-RISK" \]; then/);
    expect(SKILL).toMatch(/For STANDARD, the command reads advisor stdout directly/);
    expect(SKILL).toMatch(/does not reference\s+the HIGH-RISK-only evidence variables/);
  });
});

describe('roast-code proportional program', () => {
  it('carries no deterministic scanner phase at all', () => {
    expect(SKILL).not.toMatch(/slop-scan/i);
    expect(SKILL).not.toMatch(/## Pass 0/);
    expect(SIN_CATEGORIES).not.toMatch(/slop-scan/i);
  });

  it('reserves disk-backed diff capture for high-risk changes', () => {
    expect(SKILL).toMatch(/\*\*SMALL and STANDARD:\*\* read the diff directly/);
    expect(SKILL).toMatch(/Skip\s+the evidence capture below/);
    expect(SKILL).toMatch(/\*\*HIGH-RISK:\*\* persist the authoritative diff/);
  });

  it('reserves the second pass for larger or risky changes', () => {
    expect(SKILL).toMatch(
      /## Pass 2: Parent Roast \+ Gated Codex Review\s+\*\*STANDARD and HIGH-RISK only\.\*\*/,
    );
  });

  it('gives small reviews a flat verdict instead of the tiered inventory', () => {
    expect(SKILL).toContain('## SMALL Verdict');
    expect(SKILL).toMatch(/no tier headers, no worst-offender\s+spotlight, no fix menu/);
    expect(SKILL).toMatch(/at most 3 findings/);
    expect(SKILL).toMatch(/## Sin Inventory\s+\*\*STANDARD and HIGH-RISK\.\*\*/);
    expect(SKILL.indexOf('## SMALL Verdict')).toBeLessThan(
      SKILL.indexOf('## Sin Inventory'),
    );
    expect(SKILL).toMatch(
      /Start with the Phase 1 scope announcement containing the literal words `SMALL\s+review`/,
    );
    expect(SKILL).toMatch(
      /if the Phase 1 class is SMALL, stop and return the SMALL Verdict/,
    );
    expect(SKILL).toMatch(/Do not open this section or use any taxonomy tier label/);
  });

  it('keeps the fixed taxonomy for the classes that use tiers', () => {
    expect(SKILL).toContain(
      '**CAPITAL OFFENSES / FELONIES / CRIMES / MISDEMEANORS / PARKING TICKETS**',
    );
    expect(SKILL).toMatch(
      /a security, data-loss, or crash-level problem/,
    );
    expect(SKILL).toMatch(
      /do not inflate a finding's\s+severity to justify a bigger program/,
    );
  });

  it('escalates a small change that provably does not work', () => {
    expect(SKILL).toMatch(
      /a provable no-op — the fix cannot execute or affect the path it targets/,
    );
    expect(SKILL).toMatch(
      /A no-op fix is\s+different in kind/,
    );
    expect(SKILL).toMatch(
      /Wrong output from a path that does execute is an ordinary correctness bug/,
    );
  });

  it('drops empty tiers and the fix menu instead of padding output', () => {
    expect(SKILL).toMatch(
      /Drop a tier that has nothing in it rather than filling it/,
    );
    expect(SKILL).toMatch(/Do not print a\s+tier menu/);
    expect(SKILL).not.toMatch(/^- a\) CAPITAL OFFENSES only$/m);
    expect(SKILL).toMatch(/Deliver 1-3 opening zingers/);
  });

  it('bans a leaked secret value everywhere, not just in its own finding', () => {
    expect(SKILL).toMatch(
      /The ban covers the whole response, not just the finding that flags the\s+secret/,
    );
    expect(SKILL).toMatch(/does not license quoting it in a zinger, an aside/);
  });

  it('sweeps for duplicate copies of anything it fixed', () => {
    expect(SKILL).toMatch(/\*\*Sweep for the other copies\.\*\*/);
    expect(SKILL).toMatch(
      /A rule that exists twice and is\s+fixed once ships the bug in the copy you did not read/,
    );
  });

  it('bans ceremony-driven findings and keeps the positive assertion in every class', () => {
    expect(SKILL).toMatch(/\*\*Never manufacture findings to fill ceremony\*\*/);
    expect(SKILL).toMatch(/## Zero-Finding Gate\s+Applies in every class/);
    expect(SKILL).toMatch(
      /A\s+clean review that invents a finding rather than say "clean" is worse/,
    );
    expect(SKILL).toMatch(
      /Walk this list for STANDARD and HIGH-RISK\. For SMALL, only report a blocker/,
    );
  });
});
