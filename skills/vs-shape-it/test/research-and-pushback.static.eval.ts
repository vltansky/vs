import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const PUSHBACK = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'vs-pushback', 'SKILL.md'),
  'utf8',
);

describe('shape-it: research flow', () => {
  it('runs external research without asking when it would change the recommendation', () => {
    expect(SKILL).toMatch(/#### Research prior art/);
    expect(SKILL).toMatch(/run one without asking when the answer would change the\s+recommendation/i);
  });

  it('names the concrete research skills to chain into', () => {
    expect(SKILL).toMatch(/vs-octocode\/SKILL\.md/);
    expect(SKILL).toMatch(/vs-rfc-research\/SKILL\.md/);
    expect(SKILL).toMatch(/vs-steal\/SKILL\.md/);
  });

  it('offers research as a user choice and allows an explicit skip', () => {
    expect(SKILL).toMatch(/offer it as an opening-round choice/i);
    expect(SKILL).toMatch(/not a\s+default tax on every session/i);
  });

  it('treats research as evidence rather than authority', () => {
    expect(SKILL).toMatch(/research is evidence, not authority/i);
  });
});

describe('shape-it: pushback always runs at the end', () => {
  it('stress-tests after the design and execution strategy are complete', () => {
    const design = SKILL.indexOf('#### Design\n');
    const strategy = SKILL.indexOf('#### Design the execution strategy');
    const stressTest = SKILL.indexOf('#### Stress-test with pushback');
    const closing = SKILL.indexOf('### 3. Closing interaction');

    expect(design).toBeGreaterThan(-1);
    expect(stressTest).toBeGreaterThan(strategy);
    expect(closing).toBeGreaterThan(stressTest);
  });

  it('has no size threshold for running pushback', () => {
    expect(SKILL).toMatch(/every explore session ends its independent beat/i);
    expect(SKILL).toMatch(/there is\s+no size threshold/i);
    expect(SKILL).not.toMatch(/For large, cross-domain, or expensive-to-reverse work, use a fresh/i);
  });

  it('chains by loading the pushback skill file', () => {
    expect(SKILL).toMatch(/vs-pushback\/SKILL\.md/);
  });

  it('folds findings into the design and surfaces the verdict at the closing gate', () => {
    expect(SKILL).toMatch(/fold supported findings into the design/i);
    expect(SKILL).toMatch(/design\s+is ready to build[\s\S]+READY_WITH_RISKS/);
    expect(SKILL).not.toMatch(/does not block the approval gate/i);
    expect(SKILL).toMatch(/NOT_READY[\s\S]*rework only/i);
    expect(SKILL).toMatch(/Approval exists only for READY or READY_WITH_RISKS/);
  });

  it('pins NOT_READY as rework and READY as approve, exclusively', () => {
    const closing = SKILL.slice(SKILL.indexOf('### 3. Closing interaction'));
    expect(closing).not.toMatch(/does not block the approval gate/i);
    expect(closing).toMatch(/NOT_READY: rework only/i);
    expect(closing).toMatch(/do not offer approve or `\/vs-build-it`/i);
    expect(closing).toMatch(/READY or READY_WITH_RISKS: approval/i);
    expect(closing).toMatch(/If the\s+composed pushback verdict is NOT_READY, skip the approval gate/i);
    expect(closing).toMatch(/Your action\s+is rework/i);
    expect(closing).toMatch(/On READY or READY_WITH_RISKS only, default to the approved spec/i);
    expect(closing).toMatch(/On NOT_READY, skip that default/i);
    expect(closing).not.toMatch(/^Default to the approved spec, then `\/vs-build-it`/m);
  });

  it('checks research and pushback before finishing', () => {
    expect(SKILL).toMatch(/external research either ran with its finding cited, or was skipped/i);
    expect(SKILL).toMatch(/pushback ran in composed mode over the finished design/i);
    expect(SKILL).toMatch(
      /READY or READY_WITH_RISKS: the design has one approval gate[\s\S]*NOT_READY has no approval gate/,
    );
  });
});

describe('pushback: composed mode', () => {
  it('runs non-interactively when another workflow composes it', () => {
    expect(PUSHBACK).toMatch(/## Composed mode/);
    expect(PUSHBACK).toMatch(/run non-interactively/i);
    expect(PUSHBACK).toMatch(/Do not open question rounds, create artifacts, or invoke eli5/i);
  });

  it('keeps the investigation, qualitative verdict, and risk-aware routing', () => {
    expect(PUSHBACK).toMatch(/Keep the evidence work, Ponytail alternative,\s+and verdict/i);
    expect(PUSHBACK).toMatch(/record the decision as\s+unresolved/i);
    expect(PUSHBACK).toMatch(/premise challenge stays mandatory/i);
    expect(PUSHBACK).toMatch(/Numeric confidence\s+adds false precision/i);
  });

  it('does not upgrade itself into an interactive grill', () => {
    expect(PUSHBACK).toMatch(/do not upgrade a small request into full ceremony/i);
  });

  it('publishes a flow contract for composing workflows', () => {
    expect(PUSHBACK).toMatch(/## Flow Contract/);
    expect(PUSHBACK).toMatch(/\*\*Consumers:\*\*.*vs-shape-it/);
  });
});
