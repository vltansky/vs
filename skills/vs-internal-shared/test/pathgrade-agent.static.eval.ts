import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PATHGRADE_CODEX_MODEL,
  resolvePathgradeAgentOptions,
} from './pathgrade-agent';

function evalFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return evalFiles(entryPath);
    return entry.name.endsWith('.eval.ts') ? [entryPath] : [];
  });
}

describe('PathGrade agent defaults', () => {
  it('runs Codex Luna by default', () => {
    expect(resolvePathgradeAgentOptions({}, {})).toEqual({
      agent: 'codex',
      model: 'gpt-5.6-luna',
    });
    expect(DEFAULT_PATHGRADE_CODEX_MODEL).toBe('gpt-5.6-luna');
  });

  it('preserves explicit agent and model overrides', () => {
    expect(
      resolvePathgradeAgentOptions(
        { agent: 'claude', model: 'claude-sonnet-4-5' },
        {},
      ),
    ).toEqual({ agent: 'claude', model: 'claude-sonnet-4-5' });

    expect(
      resolvePathgradeAgentOptions(
        { agent: 'codex', model: 'gpt-5.6-sol' },
        {},
      ),
    ).toEqual({ agent: 'codex', model: 'gpt-5.6-sol' });
  });

  it('allows environment overrides without applying a Codex model to Claude', () => {
    expect(
      resolvePathgradeAgentOptions(
        {},
        { PATHGRADE_AGENT: 'claude', PATHGRADE_CODEX_MODEL: 'ignored' },
      ),
    ).toEqual({ agent: 'claude' });

    expect(
      resolvePathgradeAgentOptions(
        {},
        { PATHGRADE_AGENT: 'codex', PATHGRADE_CODEX_MODEL: 'gpt-custom' },
      ),
    ).toEqual({ agent: 'codex', model: 'gpt-custom' });
  });

  it('routes every eval agent through the repository defaults', () => {
    const skillsDir = path.resolve(__dirname, '..', '..');
    const bypasses = evalFiles(skillsDir).filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return (
        source.includes('createAgent(') &&
        !source.includes("from './pathgrade-agent'") &&
        !source.includes("from '../../vs-internal-shared/test/pathgrade-agent'")
      );
    });

    expect(bypasses).toEqual([]);
  });
});
