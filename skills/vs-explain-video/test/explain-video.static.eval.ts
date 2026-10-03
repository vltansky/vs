import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(path.join(DIR, 'agents', 'openai.yaml'), 'utf8');
const SCRIPTS = path.join(DIR, 'scripts');
const PREFLIGHT = path.join(SCRIPTS, 'preflight.mjs');
const MUX = path.join(SCRIPTS, 'mux.mjs');
const NARRATE = fs.readFileSync(path.join(SCRIPTS, 'narrate.mjs'), 'utf8');
const RENDER = fs.readFileSync(path.join(SCRIPTS, 'render-scenes.mjs'), 'utf8');
const MUX_SOURCE = fs.readFileSync(path.join(SCRIPTS, 'mux.mjs'), 'utf8');

const hasFfmpeg =
  spawnSync('/bin/sh', ['-c', 'command -v ffmpeg && command -v ffprobe']).status === 0;

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
    expect(SKILL).toContain('~/.vs/$PROJECT_ID/videos/<topic>/');
    expect(SKILL).toMatch(/Never\s+commit\s+videos/);
  });

  it('verifies duration and looks at frames before claiming done', () => {
    expect(SKILL).toMatch(/ffprobe\s+duration/);
    expect(SKILL).toMatch(/Open\s+each\s+extracted\s+still\s+and\s+look\s+at\s+it/);
    expect(SKILL).toMatch(/A\s+frame\s+you\s+did\s+not\s+look\s+at\s+is\s+not\s+verified/);
  });

  it('burns subtitles in once and never ships a second track', () => {
    expect(SKILL).toMatch(/burns\s+subtitles\s+into\s+each\s+html\s+scene/);
    expect(SKILL).toMatch(/Do\s+not\s+add\s+a\s+soft\s+subtitle\s+track\s+or\s+a\s+sidecar\s+`\.srt`/);
    expect(RENDER).toMatch(/vs-subtitle/);
    expect(MUX_SOURCE).not.toMatch(/mov_text|-c:s|subtitles=/);
  });

  it('separates spoken text from written text and times builds to sentences', () => {
    expect(SKILL).toMatch(/`pronounce`\s+changes\s+only\s+what\s+the\s+voice\s+says/);
    expect(SKILL).toMatch(/sentence\s+start\s+from\s+the\s+`cues`/);
    expect(NARRATE).toMatch(/manifest\.pronounce/);
    expect(NARRATE).toMatch(/scene\.sentences\s*=/);
  });

  it('carries one concrete example and checks every fully built scene', () => {
    expect(SKILL).toMatch(/Carry\s+one\s+concrete\s+example\s+through\s+every\s+scene/);
    expect(SKILL).toMatch(/Every\s+sentence\s+gets\s+a\s+visual\s+change/);
    expect(SKILL).toMatch(/one\s+still\s+per\s+scene/);
  });

  it('keeps the video short and disposable', () => {
    expect(SKILL).toMatch(/60-120\s+second/);
    expect(SKILL).toMatch(/disposable/);
    expect(SKILL).toMatch(/Do\s+not\s+add\s+HyperFrames,\s+Remotion,\s+or\s+Manim\s+to\s+a\s+project/);
  });
});

describe('vs-explain-video preflight', () => {
  it('prints a JSON report and exits 0 or 2 whatever is installed', () => {
    const result = spawnSync(process.execPath, [PREFLIGHT], {
      encoding: 'utf8',
      env: { ...process.env, ELEVENLABS_API_KEY: 'sk-canary-should-never-print' },
    });
    expect([0, 2]).toContain(result.status);
    expect(result.stdout + result.stderr).not.toContain('sk-canary-should-never-print');

    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(result.status === 0);
    expect(report.tts.elevenlabs).toEqual({ keyPresent: true });
    expect(report.ttsEngine).toBe('elevenlabs');
    expect(Object.keys(report.tools)).toEqual(
      expect.arrayContaining(['ffmpeg', 'ffprobe', 'playwright', 'manim']),
    );
    expect(Array.isArray(report.missing)).toBe(true);
    expect(typeof report.next).toBe('string');
    for (const item of report.missing) expect(item.install).toMatch(/\S/);
  });

  it('is blocked with install hints when nothing is on PATH', () => {
    const result = spawnSync(process.execPath, [PREFLIGHT], {
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

describe.skipIf(!hasFfmpeg || process.platform !== 'darwin')('vs-explain-video narrate', () => {
  it('speaks per sentence, applies pronounce to audio only, and records cues', () => {
    const work = mkdtempSync(path.join(tmpdir(), 'vs-explain-video-narrate-'));
    const narration = 'AICM installs nile v1.2 for you. Then it updates.';
    writeFileSync(
      path.join(work, 'scenes.json'),
      JSON.stringify({ pronounce: { AICM: 'A I C M' }, scenes: [{ id: '01', narration }] }),
    );
    const result = spawnSync(
      process.execPath,
      [path.join(SCRIPTS, 'narrate.mjs'), path.join(work, 'scenes.json'), '--engine', 'say'],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const [scene] = JSON.parse(fs.readFileSync(path.join(work, 'scenes.json'), 'utf8')).scenes;
    expect(scene.narration).toBe(narration);
    expect(scene.sentences.map((s: { text: string }) => s.text)).toEqual([
      'AICM installs nile v1.2 for you.',
      'Then it updates.',
    ]);
    expect(scene.sentences[0].start).toBe(0);
    expect(scene.sentences[1].start).toBeGreaterThan(scene.sentences[0].seconds);
    expect(scene.audio).toBe(path.join('audio', '01.wav'));
    expect(fs.readdirSync(path.join(work, 'audio'))).toEqual(['01.wav']);
  });
});

describe.skipIf(!hasFfmpeg)('vs-explain-video mux', () => {
  it('joins scenes to the narration length and extracts stills', () => {
    const work = mkdtempSync(path.join(tmpdir(), 'vs-explain-video-'));
    const ffmpeg = (args: string[]) =>
      expect(spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]).status).toBe(0);
    ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', path.join(work, 'a1.wav')]);
    ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=660:duration=0.8', path.join(work, 'a2.wav')]);
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=320x180:d=0.5', path.join(work, 'v1.mp4')]);
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=320x180', '-frames:v', '1', path.join(work, 'i2.png')]);
    writeFileSync(
      path.join(work, 'scenes.json'),
      JSON.stringify({
        fps: 24,
        width: 320,
        height: 180,
        pause: 0.3,
        scenes: [
          { id: '01', narration: 'One.', audio: 'a1.wav', video: 'v1.mp4' },
          { id: '02', narration: 'Two.', audio: 'a2.wav', image: 'i2.png' },
        ],
      }),
    );

    const result = spawnSync(
      process.execPath,
      [MUX, path.join(work, 'scenes.json'), '--out', path.join(work, 'out.mp4')],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.expectedSeconds).toBeCloseTo(2.6, 1);
    expect(report.durationMatches).toBe(true);
    expect(report.stills).toHaveLength(2);
    for (const still of report.stills) expect(fs.existsSync(still.file)).toBe(true);
  });
});
