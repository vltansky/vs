import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('shape-it: risk-first vertical delivery', () => {
  it('requires the smallest valuable deployable slice', () => {
    expect(SKILL).toMatch(/smallest valuable, deployable end-to-end slice/i);
    expect(SKILL).toMatch(/smallest complete outcome/i);
  });

  it('separates first-delivery requirements from later depth', () => {
    expect(SKILL).toMatch(/later\s+reliability, scale, analytics/i);
    expect(SKILL).toMatch(/larger first\s+slice needs evidence/i);
  });

  it('requires new value beyond the confirmed baseline', () => {
    expect(SKILL).toMatch(/advance the approved outcome beyond the confirmed baseline/i);
    expect(SKILL).toMatch(/silently substituting lower-value work/i);
  });

  it('orders user dependencies and invalidating assumptions first', () => {
    expect(SKILL).toMatch(/user-provided access, credentials, approvals/i);
    expect(SKILL).toMatch(/assumption most likely to invalidate/i);
  });

  it('defines risk-first as retiring uncertainty, not defensive depth', () => {
    expect(SKILL).toMatch(/risk first.*retire delivery uncertainty/i);
    expect(SKILL).toMatch(/does not mean build\s+the largest defensive subsystem/i);
  });
});
