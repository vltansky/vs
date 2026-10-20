import fs from 'node:fs';
import path from 'node:path';

// Assertions exercise the instructions an agent loads at Step 2, in workflow order.
export const SHIP_IT_SOURCE = fs.readFileSync(path.resolve(__dirname, '../SKILL.md'), 'utf8')
  .replace('Read and follow [PR body format](references/pr-body.md) before writing the body.',
    fs.readFileSync(path.resolve(__dirname, '../references/pr-body.md'), 'utf8'));
