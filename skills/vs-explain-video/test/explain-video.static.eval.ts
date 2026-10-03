import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const CRAFT = fs.readFileSync(path.join(DIR, 'references', 'motion-craft.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(path.join(DIR, 'agents', 'openai.yaml'), 'utf8');
const SCRIPTS = path.join(DIR, 'scripts');
const script = (name: string) => path.join(SCRIPTS, name);
const NARRATE = fs.readFileSync(script('narrate.mjs'), 'utf8');
const RENDER = fs.readFileSync(script('render.mjs'), 'utf8');
const MOTION = fs.readFileSync(path.join(DIR, 'assets', 'motion.js'), 'utf8');

const hasFfmpeg =
  spawnSync('/bin/sh', ['-c', 'command -v ffmpeg && command -v ffprobe']).status === 0;
const node = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(process.execPath, args, { encoding: 'utf8', env });

// init.mjs downloads fonts once into ~/.cache; seed a fake cache so tests stay offline.
function initWork(): string {
  const home = mkdtempSync(path.join(tmpdir(), 'vs-explain-video-home-'));
  const fonts = path.join(home, '.cache', 'vs-explain-video', 'fonts');
  fs.mkdirSync(fonts, { recursive: true });
  for (const file of ['SpaceGrotesk.ttf', 'JetBrainsMono.ttf']) writeFileSync(path.join(fonts, file), '');
  const work = path.join(home, 'work');
  const result = node([script('init.mjs'), work], { ...process.env, HOME: home });
  expect(result.status, result.stderr).toBe(0);
  return work;
}

describe('vs-explain-video contract', () => {
  it('is a building block with the shared route and output style', () => {
    expect(SKILL).toMatch(/^name: vs-explain-video$/m);
    expect(SKILL).toMatch(/\*\*Kind:\*\*\s+Building block/);
    expect(SKILL).toContain('vs-internal-shared/references/output-style.md');
    expect(SKILL).toMatch(
      /## Workflow\s+Direct: emit \*\*Next\*\* only\. Composed: return to caller\.\s+\*\*Prev:\*\*/,
    );
    expect(OPENAI_CONFIG).toMatch(/allow_implicit_invocation:\s+true/);
    expect(SKILL.split('\n').length).toBeLessThan(200);
  });

  it('writes narration in STE plain English by pointer, not by copy', () => {
    expect(SKILL).toContain('../vs-internal-shared/references/ste-writing.md');
    expect(SKILL).toMatch(/vs-write\/scripts\/check-ste\.mjs\s+narration\.md/);
    expect(SKILL).toMatch(/ASD-STE100/);
    expect(SKILL).toMatch(/Pointer\s+only/);
  });

  it('never leaks the ElevenLabs key', () => {
    expect(SKILL).toMatch(/ELEVENLABS_API_KEY/);
    expect(SKILL).toMatch(/Never\s+print,\s+log,\s+echo,\s+or\s+write\s+the\s+key/);
    expect(SKILL).toMatch(/Never\s+ask\s+the\s+user\s+to\s+paste\s+it\s+into\s+chat/);
    // The key travels only as a request header, never via argv or output.
    expect(NARRATE).toMatch(/'xi-api-key':\s*key/);
    expect(NARRATE).not.toMatch(/(console\.log|stdout\.write|stderr\.write)\([^)]*\bkey\b/);
    expect(NARRATE).not.toMatch(/run\([^)]*ELEVENLABS_API_KEY/);
  });

  it('falls back to free local TTS', () => {
    expect(SKILL).toMatch(/kokoro,\s+then\s+piper,\s+then\s+macOS\s+`say`/);
  });

  it('saves the video outside the repo and never commits it', () => {
    expect(SKILL).toContain('$HOME/.vs/$PROJECT_ID/videos/<topic>');
    expect(SKILL).toContain('~/.vs/$PROJECT_ID/videos/<topic>/');
    expect(SKILL).toMatch(/Never\s+commit\s+videos/);
  });

  it('audits stills, looks at them, and checks duration before claiming done', () => {
    expect(SKILL).toMatch(/render\.mjs\s+"\$WORK"\s+--stills/);
    expect(SKILL).toMatch(/open\s+each\s+still\s+and\s+look\s+at\s+it/);
    expect(SKILL).toMatch(/A\s+frame\s+you\s+did\s+not\s+look\s+at\s+is\s+not\s+verified/);
    expect(SKILL).toMatch(/ffprobe\s+duration/);
    expect(RENDER).toMatch(/VS\.audit\(\)/);
    expect(RENDER).toMatch(/Math\.abs\(durationSeconds - seconds\) <= 0\.25/);
  });

  it('burns subtitles in once and never ships a second track', () => {
    expect(SKILL).toMatch(/Subtitles\s+are\s+burned\s+in\s+only/);
    expect(SKILL).toMatch(/Do\s+not\s+add\s+a\s+soft\s+subtitle\s+track\s+or\s+a\s+sidecar\s+`\.srt`/);
    expect(MOTION).toMatch(/TL\.subs/);
    expect(RENDER).not.toMatch(/mov_text|-c:s|subtitles=/);
  });

  it('separates spoken text from written text and times builds to beats', () => {
    expect(SKILL).toMatch(/`pronounce`\s+changes\s+only\s+what\s+the\s+voice\s+says/);
    expect(SKILL).toMatch(/Start\s+the\s+build\s+for\s+beat\s+i\s+at\s+`B\[i\]`/);
    expect(NARRATE).toMatch(/script\.pronounce/);
  });

  it('carries one example, builds every beat, and keeps motion seekable', () => {
    expect(SKILL).toMatch(/Carry\s+one\s+concrete\s+example\s+through\s+every\s+scene/);
    expect(SKILL).toMatch(/Every\s+sentence\s+gets\s+a\s+visual\s+change/);
    expect(SKILL).toMatch(/Never\s+use\s+timers,\s+`requestAnimationFrame`,\s+or\s+CSS\s+animations/);
    expect(SKILL).toMatch(/keep\s+old\s+state\s+dimmed\s+rather\s+than\s+removed/);
    expect(SKILL).toContain('references/motion-craft.md');
    expect(CRAFT).toMatch(/Color\s+has\s+one\s+meaning\s+each/);
    expect(MOTION).not.toMatch(/requestAnimationFrame\(|setTimeout\(|setInterval\(|Date\.now\(/);
  });

  it('keeps the video short and disposable', () => {
    expect(SKILL).toMatch(/60-120\s+second/);
    expect(SKILL).toMatch(/disposable/);
    expect(SKILL).toMatch(/Do\s+not\s+add\s+HyperFrames,\s+Remotion,\s+or\s+Manim\s+to\s+a\s+project/);
  });
});

describe('vs-explain-video preflight', () => {
  it('prints a JSON report and exits 0 or 2 whatever is installed', () => {
    const result = node([script('preflight.mjs')], {
      ...process.env,
      ELEVENLABS_API_KEY: 'sk-canary-should-never-print',
    });
    expect([0, 2]).toContain(result.status);
    expect(result.stdout + result.stderr).not.toContain('sk-canary-should-never-print');

    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(result.status === 0);
    expect(report.tts.elevenlabs).toEqual({ keyPresent: true });
    expect(report.ttsEngine).toBe('elevenlabs');
    expect(Object.keys(report.tools)).toEqual(
      expect.arrayContaining(['ffmpeg', 'ffprobe', 'playwright']),
    );
    expect(typeof report.next).toBe('string');
    for (const item of report.missing) expect(item.install).toMatch(/\S/);
  });

  it('is blocked with install hints when nothing is on PATH', () => {
    const result = spawnSync(process.execPath, [script('preflight.mjs')], {
      encoding: 'utf8',
      cwd: tmpdir(),
      env: { PATH: '/nonexistent', HOME: tmpdir() },
    });
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(false);
    expect(report.tts.elevenlabs.keyPresent).toBe(false);
    expect(report.missing.map((item: { tool: string }) => item.tool)).toContain('ffmpeg');
    expect(report.next).toMatch(/rerun preflight\.mjs/);
  });
});

describe('vs-explain-video init and dry run', () => {
  it('scaffolds the stage and example, and never overwrites the user script', () => {
    const work = initWork();
    for (const file of ['index.html', 'motion.js', 'script.json', 'scenes.js', 'fonts/SpaceGrotesk.ttf']) {
      expect(fs.existsSync(path.join(work, file)), file).toBe(true);
    }
    writeFileSync(path.join(work, 'scenes.js'), '// mine');
    const again = node([script('init.mjs'), work], { ...process.env, HOME: path.dirname(work) });
    expect(JSON.parse(again.stdout).kept).toEqual(['script.json', 'scenes.js']);
    expect(fs.readFileSync(path.join(work, 'scenes.js'), 'utf8')).toBe('// mine');
  });

  it('writes narration.md and estimates length without any TTS', () => {
    const work = initWork();
    const result = node([script('narrate.mjs'), path.join(work, 'script.json'), '--dry-run'], {
      PATH: '/nonexistent',
    });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.scenes).toBe(3);
    expect(report.estimatedSeconds).toBeGreaterThan(10);
    expect(fs.readFileSync(path.join(work, 'narration.md'), 'utf8').split('\n\n')).toHaveLength(3);
  });

  it('rejects a scene without beats', () => {
    const work = mkdtempSync(path.join(tmpdir(), 'vs-explain-video-bad-'));
    writeFileSync(path.join(work, 'script.json'), JSON.stringify({ scenes: [{ id: 'a', narration: 'x' }] }));
    const result = node([script('narrate.mjs'), path.join(work, 'script.json'), '--dry-run']);
    expect(result.status).toBe(2);
    expect(result.stdout + result.stderr).toMatch(/"beats" must be a list/);
  });
});

describe.skipIf(!hasFfmpeg || process.platform !== 'darwin')('vs-explain-video narrate', () => {
  it('times beats into timeline.js, keeps written text in subtitles, and caches audio', () => {
    const work = mkdtempSync(path.join(tmpdir(), 'vs-explain-video-narrate-'));
    const scriptJson = path.join(work, 'script.json');
    writeFileSync(
      scriptJson,
      JSON.stringify({
        pronounce: { AICM: 'A I C M' },
        scenes: [{ id: 'one', beats: ['AICM installs nile for you.', 'Then it updates.'] }],
      }),
    );
    const first = node([script('narrate.mjs'), scriptJson, '--engine', 'say']);
    expect(first.status, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout).spokenNow).toBe(2);

    const source = fs.readFileSync(path.join(work, 'timeline.js'), 'utf8');
    const TL = JSON.parse(source.replace(/^window\.TL = /, '').replace(/;\s*$/, ''));
    const [scene] = TL.scenes;
    expect(scene.beats.map((b: { text: string }) => b.text)).toEqual([
      'AICM installs nile for you.',
      'Then it updates.',
    ]);
    expect(scene.beats[1].t).toBeGreaterThan(scene.beats[0].t + scene.beats[0].d);
    expect(TL.subs[0][2]).toContain('AICM');
    expect(fs.existsSync(path.join(work, 'narration.wav'))).toBe(true);

    const second = node([script('narrate.mjs'), scriptJson, '--engine', 'say']);
    expect(JSON.parse(second.stdout)).toMatchObject({ spokenNow: 0, cached: 2 });
  });
});
