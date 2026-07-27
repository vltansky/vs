import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHAPE_IT = fs.readFileSync(
  path.resolve(ROOT, 'skills', 'vs-shape-it', 'SKILL.md'),
  'utf8',
);
const BUILD_IT = fs.readFileSync(
  path.resolve(ROOT, 'skills', 'vs-build-it', 'SKILL.md'),
  'utf8',
);
const HANDOFF = fs.readFileSync(
  path.resolve(ROOT, 'skills', 'vs-build-it', 'references', 'handoff.md'),
  'utf8',
);
const ADR = fs.readFileSync(
  path.resolve(ROOT, 'adr', 'record-repo-level-decisions-before-implementation.md'),
  'utf8',
);

describe('shape-it: drafts the decision record', () => {
  it('resolves the ADR question during independent shaping, before the closing gate', () => {
    const record = SHAPE_IT.indexOf('#### Record the decision');
    const spec = SHAPE_IT.indexOf('#### Finalize the spec');
    const closing = SHAPE_IT.indexOf('### 3. Closing interaction');

    expect(record).toBeGreaterThan(-1);
    expect(spec).toBeGreaterThan(record);
    expect(closing).toBeGreaterThan(record);
  });

  it('writes the ADR rather than recommending one', () => {
    expect(SHAPE_IT).toMatch(/write `adr\/<slug>\.md` now, before the closing interaction/i);
    expect(SHAPE_IT).not.toMatch(
      /For an expensive-to-reverse repo-level decision, recommend an ADR/,
    );
  });

  it('requires a stated outcome either way', () => {
    expect(SHAPE_IT).toMatch(/silence is not an\s+allowed outcome/i);
    expect(SHAPE_IT).toMatch(/when no repo-level decision was settled, say so in one clause/i);
  });

  it('keeps the ADR out of implementation territory', () => {
    expect(SHAPE_IT).toMatch(/writing an ADR is a decision record, not implementation/i);
    expect(SHAPE_IT).toMatch(/leave it uncommitted and add no `Status` field/i);
    expect(SHAPE_IT).toMatch(/never edit a merged ADR/i);
  });

  it('carries the record into the Goal Contract and the approval gate', () => {
    expect(SHAPE_IT).toMatch(/- ADR: <path\(s\) to the decision record\(s\) build-it must honor/);
    expect(SHAPE_IT).toMatch(/the whole design, Goal Contract, any ADR, and any\s+execution blueprint are visible/i);
    expect(SHAPE_IT).toMatch(/the ADR question was resolved with a stated outcome/i);
  });

  it('defers to /vs-setup-adr instead of inventing a convention', () => {
    expect(SHAPE_IT).toMatch(/recommend\s+`\/vs-setup-adr`/);
  });
});

describe('build-it: honors the record before it writes code', () => {
  it('reads named ADRs in Phase 0 and treats them as binding', () => {
    expect(BUILD_IT).toMatch(/read every ADR the plan names/i);
    expect(BUILD_IT).toMatch(
      /a recorded decision is binding: it\s+outranks the decision principles/i,
    );
  });

  it('records durable decisions in Phase 2, before any implementation commit', () => {
    const phase2 = BUILD_IT.indexOf('## Phase 2: Fix the Plan');
    const record = BUILD_IT.indexOf(
      '### Step 5: Record durable decisions before implementing them',
    );
    const phase3 = BUILD_IT.indexOf('## Phase 3: Execute');

    expect(record).toBeGreaterThan(phase2);
    expect(phase3).toBeGreaterThan(record);
    expect(BUILD_IT).toMatch(/commit it\s+before the first implementation commit/i);
  });

  it('leaves only supersession to Phase 3', () => {
    expect(BUILD_IT).toMatch(/### Step 3b: Supersede a decision execution invalidated/);
    expect(BUILD_IT).not.toMatch(/### Step 3b: Capture ADRs for durable decisions/);
    expect(BUILD_IT).toMatch(/names the one it supersedes/i);
  });

  it('reports the record in the handoff', () => {
    expect(HANDOFF).toMatch(/### Decision Records/);
    expect(HANDOFF).toMatch(/written before implementation/i);
  });
});

describe('adr: record-repo-level-decisions-before-implementation', () => {
  it('grounds the split roles both skills implement', () => {
    expect(ADR).toMatch(/Shape-it drafts the ADR and owns the decision/);
    expect(ADR).toMatch(/Build-it enforces the ADR/);
    expect(ADR).toMatch(/Silence is not an allowed outcome/);
  });

  it('rejects the always-write-an-ADR alternative', () => {
    expect(ADR).toMatch(/\*\*Write an ADR for every shaped design\.\*\* Rejected/);
    expect(ADR).toMatch(/planning graveyard/);
  });
});
