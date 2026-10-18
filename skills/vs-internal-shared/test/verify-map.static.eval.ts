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

  it('repairs a stale map through a maintain pass with three outcomes', () => {
    const contract = fs.readFileSync(CONTRACT, 'utf8');
    expect(contract).not.toMatch(/stale\s+map\s+gets\s+a\s+scratch\s+diff/i);
    expect(contract).toMatch(/If\s+a\s+map\s+is\s+stale,\s+run\s+the\s+\[maintain\s+pass\]\(#maintain-pass\)/);
    const section = contract.match(/## Maintain pass[\s\S]*?(?=\n## )/)?.[0] ?? '';
    expect(section).toMatch(/one\s+source\s+reader\s+for\s+each\s+feature\s+file/i);
    expect(section).toMatch(/in\s+parallel/i);
    expect(section).toMatch(/Keep\s+the\s+evidence\s+after\s+cleanup/i);
    expect(section).toMatch(/exactly\s+one\s+of\s+these\s+three\s+outcomes/i);
    expect(section).toMatch(/\*\*clean:\*\*/);
    expect(section).toMatch(/\*\*changed:\*\*[\s\S]*?only\s+inside\s+`\.vs\/verify-map\/`/);
    expect(section).toMatch(/\*\*blocked:\*\*[\s\S]*?Name\s+the\s+blocker/);
  });

  it('reports a broken app as a product regression, not a map rewrite', () => {
    const contract = fs.readFileSync(CONTRACT, 'utf8');
    const section = contract.match(/## Maintain pass[\s\S]*?(?=\n## )/)?.[0] ?? '';
    expect(section).toMatch(/Report\s+it\s+as\s+a\s+product\s+regression/);
    expect(section).toMatch(/Do\s+not\s+rewrite\s+the\s+map\s+to\s+match\s+broken\s+behavior/);
    expect(section).toMatch(/product\s+regression\s+is\s+not\s+map\s+drift/i);
  });

  it('points vs-verify and vs-qa at the maintain pass without copying it', () => {
    for (const folder of ['vs-verify', 'vs-qa']) {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, folder, 'SKILL.md'), 'utf8');
      expect(raw, folder).toMatch(/run\s+the\s+maintain\s+pass\s+in\s+that\s+contract/);
      expect(raw, folder).not.toMatch(/exactly\s+one\s+of\s+these\s+three\s+outcomes/i);
    }
  });

  it('names .vs/verify-map/ as committed source-of-truth, distinct from session artifacts', () => {
    const shared = fs.readFileSync(SHARED_SKILL, 'utf8');
    const section =
      shared.match(/## What does NOT go here[\s\S]*?(?=\n## |\n*$)/)?.[0] ?? '';
    expect(section).toMatch(/session artifacts/);
    expect(section).toMatch(/`docs\//);
    expect(section).toMatch(/`\.context\//);
    expect(section).toMatch(/`\.octocode\//);
    expect(section).toMatch(/committed source-of-truth/);
    expect(section).toMatch(/`skills\//);
    expect(section).toMatch(/`evals\//);
    expect(section).toMatch(/`\.vs\/verify-map\//);
    expect(section).toMatch(/committed source-of-truth[\s\S]*`\.vs\/verify-map\//);
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
    expect(reject(path.join(FIX, 'stub-live-drive')).status).toBe(1);
    expect(reject(path.join(FIX, 'too-few-features')).status).toBe(1);
    expect(reject(path.join(FIX, 'missing-launch')).status).toBe(1);
    expect(reject(path.join(FIX, 'placeholder-period-launch')).status).toBe(1);
    expect(reject(path.join(FIX, 'keyword-slogan-launch')).status).toBe(1);
  });
});

