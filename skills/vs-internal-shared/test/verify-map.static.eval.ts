import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHARED = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const CONTRACT = path.join(SHARED, 'references', 'verify-map.md');
const SHARED_SKILL = path.join(SHARED, 'SKILL.md');
const REJECT = path.join(SHARED, 'scripts', 'reject-verify-map.mjs');
const FIX = path.join(__dirname, 'fixtures', 'verify-map');
const FORBIDDEN_NAMES = [
  'vs-create-verification',
  'create-verification-skill',
  'vs-maintain-verification',
  'maintain-verification-skill',
];

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

function skillFiles() {
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')))
    .map((folder) => {
      const skillPath = path.join(SKILLS_DIR, folder, 'SKILL.md');
      return { folder, skillPath, raw: fs.readFileSync(skillPath, 'utf8') };
    });
}

describe('verify-map contract', () => {
  it('does not ship a create-verification or maintain-verification skill or slash', () => {
    const skills = skillFiles();
    for (const skill of skills) {
      expect(FORBIDDEN_NAMES, skill.folder).not.toContain(skill.folder);
      const name = skill.raw.match(/^name:\s*(\S+)/m)?.[1];
      if (name) expect(FORBIDDEN_NAMES, skill.folder + ' name').not.toContain(name);
      expect(skill.raw, skill.folder).not.toMatch(/`\/vs-create-verification`/);
    }
  });

  it('has a cold-read contract that names sections, interview axes, live-drive, and project output', () => {
    expect(fs.existsSync(CONTRACT)).toBe(true);
    const contract = fs.readFileSync(CONTRACT, 'utf8');
    expect(contract).toMatch(/\bLaunch\b/);
    expect(contract).toMatch(/\bDoctor\b/);
    expect(contract).toMatch(/\bDrive\b/);
    expect(contract).toMatch(/\bEvidence\b/);
    expect(contract).toMatch(/\bSurface\b/);
    expect(contract).toMatch(/\bRun\b/);
    expect(contract).toMatch(/\bObserve\b/);
    expect(contract).toMatch(/\bIsolate\b/);
    expect(contract).toMatch(/live-drive|live drive/i);
    expect(contract).toMatch(/\.vs\/verify-map\//);
    expect(contract).not.toMatch(/pstack/i);
    expect(contract).not.toMatch(/\/create-verification-skill/);
    expect(contract).not.toMatch(/\/maintain-verification-skill/);
    expect(contract).not.toMatch(/\.cursor\/skills\/verify-/);
    const shared = fs.readFileSync(SHARED_SKILL, 'utf8');
    expect(shared).toMatch(/references\/verify-map\.md/);
  });

  it('keeps vs-verify a claim checker with a pointer, not a factory', () => {
    const verify = fs.readFileSync(path.join(SKILLS_DIR, 'vs-verify', 'SKILL.md'), 'utf8');
    expect(verify).toMatch(/verify-map\.md/);
    expect(verify).toMatch(/\.vs\/verify-map\//);
    expect(verify).not.toMatch(/Interview the repo[\s\S]{0,800}Surface:/);
    expect(verify).not.toMatch(/Write \.cursor\/skills\/verify-/);
  });

  it('points vs-qa at the same verify-map reference', () => {
    const qa = fs.readFileSync(path.join(SKILLS_DIR, 'vs-qa', 'SKILL.md'), 'utf8');
    expect(qa).toMatch(/verify-map\.md/);
    expect(qa).toMatch(/\.vs\/verify-map\//);
    expect(qa).not.toMatch(/Interview the repo[\s\S]{0,800}Surface:/);
    expect(qa).not.toMatch(/Write \.cursor\/skills\/verify-/);
  });

  it('rejects a map with no live-drive and passes a live-driven map with surviving evidence', () => {
    expect(fs.existsSync(REJECT)).toBe(true);
    const noLive = reject(path.join(FIX, 'no-live-drive'));
    expect(noLive.status).toBe(1);
    const live = reject(path.join(FIX, 'live-driven'));
    expect(live.status).toBe(0);
    expect(reject(path.join(FIX, 'too-few-features')).status).toBe(1);
    expect(reject(path.join(FIX, 'missing-launch')).status).toBe(1);
  });
});

