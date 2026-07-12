import { defineConfig } from 'vitest/config';
import { pathgrade } from '@wix/pathgrade/plugin';

// Pathgrade drives a real coding agent (Claude or Codex) per eval, so each test
// can take minutes. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY for --agent codex)
// before running. Pick the agent with PATHGRADE_AGENT=claude|codex.
export default defineConfig({
  test: {
    hookTimeout: 180_000,
    // Each eval spawns a real coding agent; cap concurrency so a full run does
    // not fan out one agent per core and rate-limit the local subscription.
    maxWorkers: 4,
    minWorkers: 1,
  },
  plugins: [pathgrade({ timeout: 600 })],
});
