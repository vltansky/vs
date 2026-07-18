import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('build-it: risk-first vertical delivery', () => {
  it('ships the smallest complete outcome instead of every planned capability', () => {
    expect(SKILL).toMatch(/smallest complete observable outcome/i);
    expect(SKILL).toMatch(/defer non-blocking depth/i);
  });

  it('surfaces user dependencies before broad implementation', () => {
    expect(SKILL).toMatch(/user or external dependency/i);
    expect(SKILL).toMatch(/before broad edits/i);
  });

  it('tests invalidating assumptions before delivering a vertical slice', () => {
    expect(SKILL).toMatch(/plan-invalidating assumption/i);
    expect(SKILL).toMatch(/deployable vertical slice/i);
    expect(SKILL).toMatch(/risk-first sequencing retires uncertainty/i);
  });

  it('does not substitute re-verification for requested new value', () => {
    expect(SKILL).toMatch(/advances the requested outcome beyond the confirmed baseline/i);
    expect(SKILL).toMatch(/substituting easier lower-value work/i);
  });

  it('does not treat architectural foundations as the default first step', () => {
    expect(SKILL).toMatch(/foundation\s+comes\s+first\s+only\s+when/i);
    expect(SKILL).toMatch(/prefer one end-to-end slice/i);
  });
});
