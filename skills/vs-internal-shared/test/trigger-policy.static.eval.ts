import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const SKILL_NAMES = fs
  .readdirSync(SKILLS_DIR)
  .filter((name) => name.startsWith('vs-'))
  .filter((name) => name !== 'vs-internal-shared')
  .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')))
  .sort();

describe('cross-host trigger policy', () => {
  it('declares an explicit Codex policy for every user-facing skill', () => {
    for (const name of SKILL_NAMES) {
      const configPath = path.join(SKILLS_DIR, name, 'agents', 'openai.yaml');
      expect(fs.existsSync(configPath), `${name} openai config`).toBe(true);

      const config = fs.readFileSync(configPath, 'utf8');
      expect(config, `${name} implicit invocation policy`).toMatch(
        /allow_implicit_invocation:\s+(true|false)/,
      );
    }
  });

  it('keeps Claude and Codex gates aligned', () => {
    for (const name of SKILL_NAMES) {
      const skill = fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
      if (!/disable-model-invocation:\s*true/.test(skill)) continue;

      const config = fs.readFileSync(
        path.join(SKILLS_DIR, name, 'agents', 'openai.yaml'),
        'utf8',
      );
      expect(config, `${name} gated Codex policy`).toMatch(
        /allow_implicit_invocation:\s+false/,
      );
    }
  });
});
