#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.VS_MINIMUM_SOLUTION?.toLowerCase() === 'off') {
  process.exit(0);
}

const pluginRoot =
  process.env.PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const instructionsPath = path.join(
  pluginRoot,
  'skills',
  'vs-internal-shared',
  'references',
  'minimum-solution.md',
);

try {
  process.stdout.write(fs.readFileSync(instructionsPath, 'utf8').trim());
} catch {
  process.exit(0);
}
