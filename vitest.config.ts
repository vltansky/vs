import { defineConfig } from 'vitest/config';
import { pathgrade } from '@wix/pathgrade/adapters/vitest';

// Pathgrade drives a real coding agent (Claude or Codex) per eval, so each test
// can take minutes. On macOS no API key is needed: pathgrade reuses the Claude
// Code OAuth login from the Keychain for both the agent under test and the judge
// scorers, without copying ~/.claude.json or enabling Claude.ai MCP connectors.
// Elsewhere set ANTHROPIC_API_KEY (or CLAUDE_CODE_OAUTH_TOKEN); Codex needs
// OPENAI_API_KEY. Pick the agent with PATHGRADE_AGENT=claude|codex.
export default defineConfig({
  test: {
    hookTimeout: 180_000,
    // Each eval spawns a real coding agent; cap concurrency so a full run does
    // not fan out one agent per core and rate-limit the local subscription.
    maxWorkers: 4,
    minWorkers: 1,
  },
  plugins: [
    pathgrade({
      timeout: 600,
      // PathGrade defaults exclude `.worktrees/**` but not Claude Code's
      // `.claude/worktrees/**`, which would otherwise multiply every static eval.
      exclude: [
        '**/node_modules/**',
        '**/.git/**',
        '.worktrees/**',
        'worktrees/**',
        '.claude/worktrees/**',
        '**/fixtures/**',
      ],
    }),
  ],
});
