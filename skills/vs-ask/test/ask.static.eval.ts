import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

it('ships a dynamic recommendation-only router', () => {
  const skill = readFileSync(resolve(__dirname, '../SKILL.md'), 'utf8');
  expect(skill).toMatch(/current session's available-skills catalog/);
  expect(skill).toMatch(/otherwise rebuild it/);
  expect(skill).toMatch(/Do not maintain a hardcoded skill map/);
  expect(skill).toMatch(/Do not start the recommended skill/);
  const manifest = JSON.parse(readFileSync(resolve(root, '.claude-plugin/plugin.json'), 'utf8'));
  expect(manifest.skills).toContain('./skills/vs-ask');
  expect(readFileSync(resolve(root, 'README.md'), 'utf8')).toContain('| `/vs-ask` |');
});
