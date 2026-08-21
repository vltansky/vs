import { defineConfig } from 'vitest/config';
import { pathgrade } from '@wix/pathgrade/adapters/vitest';

// PathGrade drives a real coding agent per behavior eval, so each test can take
// minutes. The repository default is Codex on gpt-5.6-luna. Override the agent
// with PATHGRADE_AGENT=claude|codex and the Codex model with
// PATHGRADE_CODEX_MODEL. Codex can use OPENAI_API_KEY or its cached CLI login.
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
