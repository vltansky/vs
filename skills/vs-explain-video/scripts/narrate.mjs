#!/usr/bin/env node
// Synthesizes each scene's narration to an audio file and records the path and
// duration back into the manifest.
//
//   node narrate.mjs <scenes.json> [--engine auto|elevenlabs|kokoro|piper|say]
//
// auto picks ElevenLabs when ELEVENLABS_API_KEY is set, else kokoro, piper, say.
// The key is read from the environment only and sent only as the xi-api-key
// request header. It is never printed, logged, written to disk, or put on a
// command line where `ps` could show it.
//
// Optional env: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID, KOKORO_VOICE,
// KOKORO_DIR (holds kokoro-v1.0.onnx + voices-v1.0.bin for kokoro-tts),
// PIPER_MODEL, SAY_VOICE.
//
// Exit codes: 0 every scene narrated; 2 blocked (bad manifest, no engine, TTS error).
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fail, probeDuration, readManifest, run, which, writeManifest } from './media.mjs';

const [manifestPath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const engineArg = process.argv.find((arg) => arg.startsWith('--engine='))?.slice(9)
  ?? (process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'auto');
if (!manifestPath) fail('Usage: node narrate.mjs <scenes.json> [--engine auto|elevenlabs|kokoro|piper|say]');

const pickEngine = () => {
  if (engineArg !== 'auto') return engineArg;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (which('kokoro-tts')) return 'kokoro';
  if (run('python3', ['-c', 'import kokoro']).status === 0) return 'kokoro';
  if (which('piper')) return 'piper';
  if (process.platform === 'darwin' && which('say')) return 'say';
  return null;
};

const engine = pickEngine();
if (!engine) fail('No TTS engine found. Run preflight.mjs for the install hint, then rerun narrate.mjs.');

const elevenlabs = async (text, out) => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in this shell. Export it there; do not paste it into chat.');
  const voice = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
      }),
    },
  );
  if (!response.ok) {
    // The error body is ElevenLabs' message; it does not echo the key.
    throw new Error(`ElevenLabs returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  writeFileSync(out, Buffer.from(await response.arrayBuffer()));
};

const KOKORO_PY = `
import sys, numpy as np, soundfile as sf
from kokoro import KPipeline
text, out, voice = sys.stdin.read(), sys.argv[1], sys.argv[2]
chunks = [audio for _, _, audio in KPipeline(lang_code=voice[0])(text, voice=voice)]
sf.write(out, np.concatenate(chunks), 24000)
`;

const local = (text, out) => {
  const scratch = path.join(tmpdir(), `vs-narration-${process.pid}.txt`);
  writeFileSync(scratch, text);
  const voice = process.env.KOKORO_VOICE ?? 'af_heart';
  const result =
    engine === 'kokoro' && which('kokoro-tts')
      ? run('kokoro-tts', [scratch, out, '--voice', voice], { cwd: process.env.KOKORO_DIR ?? process.cwd() })
      : engine === 'kokoro'
        ? run('python3', ['-c', KOKORO_PY, out, voice], { input: text })
        : engine === 'piper'
          ? run('piper', ['--model', process.env.PIPER_MODEL ?? 'en_US-lessac-medium', '--output_file', out], { input: text })
          : run('say', [...(process.env.SAY_VOICE ? ['-v', process.env.SAY_VOICE] : []), '-o', out, '-f', scratch]);
  if (result.status !== 0) {
    throw new Error(`${engine} failed (exit ${result.status}): ${(result.stderr || result.error?.message || '').slice(0, 300)}`);
  }
};

const extension = { elevenlabs: 'mp3', kokoro: 'wav', piper: 'wav', say: 'aiff' }[engine];
if (!extension) fail(`Unknown engine "${engine}". Use auto, elevenlabs, kokoro, piper, or say.`);

const manifest = readManifest(manifestPath);
const audioDir = path.join(manifest.dir, 'audio');
mkdirSync(audioDir, { recursive: true });

for (const [index, scene] of manifest.scenes.entries()) {
  const id = scene.id ?? String(index + 1).padStart(2, '0');
  if (!scene.narration?.trim()) fail(`scene ${id} has no narration text.`);
  const out = path.join(audioDir, `${id}.${extension}`);
  try {
    if (engine === 'elevenlabs') await elevenlabs(scene.narration, out);
    else local(scene.narration, out);
  } catch (error) {
    fail(`scene ${id}: ${error.message}`);
  }
  const seconds = probeDuration(out);
  if (seconds === null) fail(`scene ${id}: ${engine} wrote ${out}, but ffprobe cannot read it.`);
  scene.audio = path.relative(manifest.dir, out);
  scene.audioSeconds = Number(seconds.toFixed(3));
}

manifest.ttsEngine = engine;
writeManifest(manifestPath, manifest);
const total = manifest.scenes.reduce((sum, scene) => sum + scene.audioSeconds, 0);
process.stdout.write(
  `${JSON.stringify({ engine, scenes: manifest.scenes.map(({ id, audio, audioSeconds }) => ({ id, audio, audioSeconds })), narrationSeconds: Number(total.toFixed(3)) }, null, 2)}\n`,
);
