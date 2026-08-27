import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
// Hard-wrap must not decide whether a rule is present.
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const REJECT = path.join(DIR, 'scripts', 'reject-code-slop.mjs');
const REJECT_SRC = fs.readFileSync(REJECT, 'utf8');
const THEATER_PATH = path.join(FIXTURE_DIR, 'try-catch-theater.ts');
const CEREMONY_PATH = path.join(FIXTURE_DIR, 'ceremony-wrapper.ts');
const CLEAN_PATH = path.join(FIXTURE_DIR, 'clean-add.ts');
const THEATER = fs.readFileSync(THEATER_PATH, 'utf8');
const CEREMONY = fs.readFileSync(CEREMONY_PATH, 'utf8');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

describe('vs-deslop: stays a code-cleanup skill', () => {
  it('keeps the Flow Contract, statuses, consumers, and result template', () => {
    expect(SKILL).toMatch(/## Flow Contract/);
    expect(SKILL).toMatch(/Building block/);
    expect(SKILL).toMatch(/`CLEAN`, `CLEANED`, `WARN`, `FAIL`, or `BLOCKED`/);
    expect(SKILL).toMatch(/vs:roast-code/);
    expect(SKILL).toMatch(/vs:build-it/);
    expect(SKILL).toMatch(/vs:ship-it/);
    expect(SKILL).toMatch(/## Deslop Result/);
    expect(SKILL).toMatch(/vs-ponytail/);
    expect(SKILL).toMatch(/composed mode/);
    expect(SKILL).toMatch(/\*\*Prev:\*\*/);
    expect(SKILL).toMatch(/\*\*Next:\*\*/);
    expect(SKILL).toMatch(/`\/vs-verify`/);
  });

  it('does not become a writing-voice or em-dash skill', () => {
    expect(SKILL).not.toMatch(/em-?dash/i);
    expect(SKILL).not.toMatch(/em[- ]dash policy/i);
    expect(SKILL).not.toMatch(/writing[- ]voice/i);
    expect(SKILL).not.toMatch(/add soul/i);
    expect(SKILL).not.toMatch(/\bdelve\b/i);
    expect(SKILL).not.toMatch(/throat-clearing/i);
    expect(SKILL).not.toMatch(/pull-quote/i);
    expect(SKILL).not.toMatch(/writer'?s (personal )?voice/i);
  });
});

describe('vs-deslop: fixture-backed reject classes', () => {
  it('keeps catalog bullets for theater and ceremony smells', () => {
    expect(SKILL).toMatch(
      /try\/catch theater: a try\/catch around non-throwing code, an empty catch, or a catch that logs and swallows a real failure/i,
    );
    expect(SKILL).toMatch(
      /ceremony types and files \(`Manager`, `Service`, `Factory`, `Helper`, `Utils`\)/i,
    );
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/reject-code-slop\.mjs/);
    expect(SKILL).not.toMatch(
      /a file that matches test\/fixtures\/try-catch-theater\.ts fails the catalog/i,
    );
    expect(SKILL).not.toMatch(
      /a file that matches test\/fixtures\/ceremony-wrapper\.ts fails the catalog/i,
    );
  });

  it('rejects try-catch theater by spawning reject-code-slop on the fixture', () => {
    expect(THEATER).toMatch(/addNonThrowingPair/);
    expect(THEATER).toMatch(/\/\* theater \*\//);
    expect(REJECT_SRC.length).toBeGreaterThan(200);
    expect(REJECT_SRC).toMatch(/addNonThrowingPair/);
    expect(REJECT_SRC).toMatch(/theater/);
    expect(REJECT_SRC).toMatch(/process\.exit\(1\)/);
    expect(reject(THEATER_PATH).status).toBe(1);
    expect(reject(CLEAN_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/addNonThrowingPair/);
    expect(SKILL).not.toMatch(/\/\* theater \*\//);
  });

  it('rejects ceremony wrappers by spawning reject-code-slop on the fixture', () => {
    expect(CEREMONY).toMatch(/WidgetManager/);
    expect(CEREMONY).toMatch(/WidgetFactory\.ts/);
    expect(REJECT_SRC).toMatch(/WidgetFactory\.ts/);
    expect(REJECT_SRC).toContain('Manager');
    expect(REJECT_SRC).toContain('WidgetUtils.ts');
    expect(reject(CEREMONY_PATH).status).toBe(1);
    expect(SKILL).toMatch(
      /must not add a (new )?(file|wrapper|interface|flag|helper)[\s\S]{0,80}that did not exist/i,
    );
    expect(SKILL).not.toMatch(/WidgetManager/);
    expect(SKILL).not.toMatch(/WidgetFactory\.ts/);
    expect(SKILL).not.toMatch(/WidgetUtils\.ts/);
  });
});

describe('vs-deslop: exclusive cleanup procedure', () => {
  it('locks behavior first, then collect-validate-delete-verify-rescan', () => {
    expect(SKILL).toMatch(
      /Exclusive order:\*?\*?\s*Lock behavior first, then collect\s*(→|->)\s*validate\/discard FP\s*(→|->)\s*surgical delete\s*(→|->)\s*verify\s*(→|->)\s*re-?scan/i,
    );
    expect(SKILL).not.toMatch(
      /Exclusive order:\*?\*?\s*collect\s*(→|->)/i,
    );
  });

  it('collects candidates and discards a real-guard false positive before editing', () => {
    expect(SKILL).toMatch(/Collect candidates\. Do not edit yet/i);
    expect(SKILL).toMatch(
      /A false positive that deletes a real guard is worse than one leftover tell/i,
    );
    expect(SKILL).toMatch(/Discard it and say why/i);
  });

  it('applies a portability test to generic helpers', () => {
    expect(SKILL).toMatch(
      /portability test[\s\S]{0,80}could move to another repo unchanged/i,
    );
  });

  it('cuts comments that only restate a signature, not a JSDoc slogan', () => {
    expect(SKILL).toMatch(
      /comments that narrate obvious code, hand-holding notes, and JSDoc that is only restating the signature/i,
    );
  });

  it('does not flatten local idiom', () => {
    expect(SKILL).toMatch(
      /flattening working house style into a generic house style is a cleanup defect/i,
    );
  });

  it('rejects fabricated evidence and leftover debug fossils with exclusive wording', () => {
    expect(SKILL).toMatch(
      /`any`, a non-null assertion \(`!`\), and an uncommented type assertion that fabricates evidence/i,
    );
    expect(SKILL).toMatch(
      /`console\.log` \/ `console\.debug` \/ `console\.info` left in production paths, and a stale TODO fossil/i,
    );
  });

  it('states the hard stop: who ends, rescan cap, CLEAN, deferred leftover', () => {
    expect(SKILL).toMatch(/The deslop run ends the pass/);
    expect(SKILL).toMatch(/At most 2 rescans\. Then stop/);
    expect(SKILL).toMatch(
      /`CLEAN` \/ `CLEANED` means no in-scope leftover is still cuttable/,
    );
    expect(SKILL).toMatch(
      /If the leftover is only deferred \(risky \/ out of scope\): WARN, not another rescan/,
    );
    expect(SKILL).toMatch(/Do not keep looping/);
    expect(SKILL).not.toMatch(/density-?stop/i);
  });
});
