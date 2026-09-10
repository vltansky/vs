import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const script = path.join(root, 'skills/vs-internal-shared/scripts/capture-demo.mjs');
const skill = (name: string) => readFileSync(path.join(root, `skills/${name}/SKILL.md`), 'utf8');

function exercise(mode: string) {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { captureDemo } from ${JSON.stringify(script)};
    import { mkdtemp, readFile, access } from 'node:fs/promises';
    import os from 'node:os';
    import path from 'node:path';
    const directory = path.join(await mkdtemp(path.join(os.tmpdir(), 'capture-demo-')), 'clip');
    const events = [];
    const page = {
      addInitScript: async () => events.push('overlay'),
      video: () => ({ path: async () => { events.push('video-path'); return 'clip.webm'; } }),
      screenshot: async () => events.push('still'),
      waitForTimeout: async ms => events.push(ms),
      mouse: Object.fromEntries(['move', 'down', 'up'].map(k => [k, async () => events.push(k)])),
    };
    const context = { newPage: async () => page, close: async () => events.push('close') };
    const browser = { newContext: async options => { events.push(options); return context; } };
    const locator = { scrollIntoViewIfNeeded: async () => {}, boundingBox: async () => ({x:0,y:0,width:44,height:44}), isEnabled: async () => true };
    let error;
    const options = { browser, directory, revision: 'abc123', scenario: 'retry', viewport: {width:390,height:844},
      run: async ({click, checkpoint}) => {
        await click(locator);
        if (${JSON.stringify(mode)} === 'empty') return;
        await checkpoint('Saved', async () => {
          events.push('assert');
          if (${JSON.stringify(mode)} === 'fail') throw new Error('Not saved');
        });
      }
    };
    try {
      await captureDemo(options);
      if (${JSON.stringify(mode)} === 'reuse') await captureDemo(options);
    } catch (e) { error = e.message; }
    let manifest;
    try { manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')); } catch {}
    console.log(JSON.stringify({ events, error, manifest }));
  `], { encoding: 'utf8' }));
}

describe('demo evidence capture', () => {
  it('asserts before taking stills and flushes video before reporting success', () => {
    const { events, manifest } = exercise('success');
    expect(events.indexOf('assert')).toBeLessThan(events.indexOf('still'));
    expect(events.indexOf('close')).toBeLessThan(events.indexOf('video-path'));
    expect(events.filter((e: unknown) => ['move', 'down', 'up'].includes(String(e)))).toEqual(['move', 'down', 'up']);
    expect(manifest).toMatchObject({ revision: 'abc123', scenario: 'retry', visualInspection: 'pending' });
    expect(manifest.checkpoints).toHaveLength(1);
  });
  it.each(['fail', 'empty'])('closes failed %s recordings without a success manifest', mode => {
    const { events, error, manifest } = exercise(mode);
    expect(error).toBeTruthy();
    expect(events).toContain('close');
    expect(events).not.toContain('video-path');
    expect(manifest).toBeUndefined();
  });
  it('rejects a reused directory before creating another context', () => {
    const { events, error } = exercise('reuse');
    expect(error).toContain('EEXIST');
    expect(events.filter((e: unknown) => e === 'close')).toHaveLength(1);
  });
  it('plans scenarios and preserves revision attribution after pushes', () => {
    expect(skill('vs-shape-it')).toMatch(/demo scenario table[\s\S]*assertion that proves/);
    expect(skill('vs-shape-it')).toMatch(/not permission to record or implement\s+during shaping/);
    expect(skill('vs-ship-it')).toMatch(/Rerecord affected clips[\s\S]*retain unaffected clips/i);
    expect(skill('vs-ship-it')).toMatch(/Do not relabel an old recording/);
  });
});
