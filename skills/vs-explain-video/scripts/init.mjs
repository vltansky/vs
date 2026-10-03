#!/usr/bin/env node
// Scaffolds an explain-video work directory:
//
//   node init.mjs <work-dir>
//
// Copies the stage (index.html) and motion kit (motion.js) every time, so a
// rerun picks up kit fixes. Copies the example script.json and scenes.js only
// when they do not exist yet; your own script and scenes are never
// overwritten. Fonts (Space Grotesk, JetBrains Mono; SIL OFL) download once to
// ~/.cache/vs-explain-video/fonts. Offline, the stage falls back to system
// fonts and the run still works.
//
// Exit codes: 0 scaffolded; 2 blocked (no work dir given).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail } from './media.mjs';

const dir = process.argv[2];
if (!dir) fail('Usage: node init.mjs <work-dir>');
const work = path.resolve(dir);
const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(path.join(work, 'fonts'), { recursive: true });

copyFileSync(path.join(assets, 'stage.html'), path.join(work, 'index.html'));
copyFileSync(path.join(assets, 'motion.js'), path.join(work, 'motion.js'));
const kept = [];
for (const [from, to] of [['script.example.json', 'script.json'], ['scenes.example.js', 'scenes.js']]) {
  if (existsSync(path.join(work, to))) kept.push(to);
  else copyFileSync(path.join(assets, from), path.join(work, to));
}

const FONTS = {
  'SpaceGrotesk.ttf': 'https://github.com/google/fonts/raw/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf',
  'JetBrainsMono.ttf': 'https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
};
const cache = path.join(homedir(), '.cache', 'vs-explain-video', 'fonts');
mkdirSync(cache, { recursive: true });
const fonts = {};
for (const [file, url] of Object.entries(FONTS)) {
  const cached = path.join(cache, file);
  if (!existsSync(cached)) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      fonts[file] = `system fallback (${error.message})`;
      continue;
    }
  }
  copyFileSync(cached, path.join(work, 'fonts', file));
  fonts[file] = 'ok';
}

process.stdout.write(`${JSON.stringify({
  workDir: work,
  kept,
  fonts,
  next: 'Write script.json (beats) and scenes.js, then run narrate.mjs --dry-run.',
}, null, 2)}\n`);
