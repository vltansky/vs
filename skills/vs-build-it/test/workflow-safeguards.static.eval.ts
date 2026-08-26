import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('build-it workflow safeguards', () => {
  it('reconciles newer decisions into the durable plan before implementation', () => {
    expect(SKILL).toMatch(/newer user decision.*conflicts with.*plan/is);
    expect(SKILL).toMatch(/update the durable plan.*before.*implementation/is);
    expect(SKILL).toMatch(/do not leave.*decision.*only in.*conversation/is);
  });

  it('requires mixed-version proof for distributed contract changes', () => {
    expect(SKILL).toMatch(/mixed-version rollout matrix/i);
    expect(SKILL).toMatch(/old producer.*new consumer/is);
    expect(SKILL).toMatch(/new producer.*old consumer/is);
    expect(SKILL).toMatch(/in-flight work.*duplicate delivery.*crash.*lease/is);
    expect(SKILL).toMatch(/cannot be called complete.*matrix.*proven/is);
  });
});

describe('build-it deslop anti-slop compose', () => {
  it('inherits the named-file runner and cannot claim CLEAN without it', () => {
    expect(SKILL).toMatch(/run-anti-slop\.mjs/);
    expect(SKILL).toMatch(/do not\s+report[\s\S]{0,20}`CLEAN`/i);
    expect(SKILL).not.toMatch(/Load[\s\S]{0,40}vs-deslop\/SKILL\.md[\s\S]{0,80}only when/);
    expect(SKILL).not.toMatch(/MENTION_ONLY_INHERIT_ANTISLOP_CANARY/);
  });
});
