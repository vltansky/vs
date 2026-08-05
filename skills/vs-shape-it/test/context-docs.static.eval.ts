import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHAPE_IT = fs.readFileSync(path.join(ROOT, 'skills', 'vs-shape-it', 'SKILL.md'), 'utf8');
const SHARED = fs.readFileSync(
  path.join(ROOT, 'skills', 'vs-internal-shared', 'references', 'context-docs.md'),
  'utf8',
);
const BUILD_IT = fs.readFileSync(path.join(ROOT, 'skills', 'vs-build-it', 'SKILL.md'), 'utf8');
const PUSHBACK = fs.readFileSync(path.join(ROOT, 'skills', 'vs-pushback', 'SKILL.md'), 'utf8');

describe('shape-it context document contract', () => {
  it('keeps context support inside the existing shaping workflow', () => {
    expect(SHAPE_IT).toMatch(/shared[\s\S]+context-docs\.md/);
    expect(SHAPE_IT).toMatch(/resolved glossary updates/);
    expect(SHAPE_IT).not.toMatch(/vs-domain-model/);
  });

  it('keeps context lazy and glossary-only', () => {
    expect(SHARED).toMatch(/not a session artifact, specification, scratchpad/);
    expect(SHARED).toMatch(/Create files lazily/);
    expect(SHARED).toMatch(/Create\s+`CONTEXT-MAP\.md` only when/);
  });

  it('gives shape-it ownership and keeps consumers read-only', () => {
    expect(SHARED).toMatch(/`vs-shape-it` owns active glossary changes/);
    expect(BUILD_IT).toMatch(/do not create or update `CONTEXT\.md`/i);
    expect(PUSHBACK).toMatch(/do not\s+create or update `CONTEXT\.md`/i);
    expect(BUILD_IT).not.toMatch(/vs-domain-model/);
    expect(PUSHBACK).not.toMatch(/vs-domain-model/);
  });

  it('reserves ADRs for durable trade-offs', () => {
    expect(SHARED).toMatch(/hard to reverse/);
    expect(SHARED).toMatch(/surprising without context/);
    expect(SHARED).toMatch(/real trade-off between alternatives/);
  });
});
