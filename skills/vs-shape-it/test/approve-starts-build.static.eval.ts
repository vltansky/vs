import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const closing = SKILL.slice(
  SKILL.indexOf('### 3. Closing interaction'),
  SKILL.indexOf('## Confusion'),
);

describe('shape-it: approve starts the build', () => {
  it('words the Your action line so approving starts /vs-build-it', () => {
    expect(closing).toMatch(
      /4\. One `Your action` line\. READY or READY_WITH_RISKS:[^\n]*Reply `approve` to start `\/vs-build-it` on this spec, or request changes/,
    );
  });

  it('invokes /vs-build-it on the approved spec in the same turn when the user approves', () => {
    expect(closing).toMatch(
      /When the user replies `approve`[^.]*, invoke `\/vs-build-it` on the approved spec path in the same turn/i,
    );
    expect(closing).toMatch(/Do not stop at a TLDR that names `\/vs-build-it` as the next step/i);
  });

  it('no longer says approval stops short of implementation', () => {
    expect(SKILL).not.toMatch(/it does not start implementation/i);
    expect(closing).not.toMatch(/Approval\s+means ready for `\/vs-build-it`/i);
  });

  it('keeps request changes as a return to shaping', () => {
    expect(closing).toMatch(/A requested change returns to shaping/i);
  });

  it('keeps approve off NOT_READY closes', () => {
    expect(closing).toMatch(/NOT_READY: rework only — do not offer approve or `\/vs-build-it`/);
    expect(closing).toMatch(/Approval exists only for READY or READY_WITH_RISKS/);
  });

  it('verifies the approve-to-build handoff before finishing', () => {
    expect(SKILL).toMatch(/`approve` on a READY or READY_WITH_RISKS close starts `\/vs-build-it`/);
    expect(SKILL).toMatch(/before approval, no implementation/i);
  });
});
