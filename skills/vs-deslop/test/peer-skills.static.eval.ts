import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
// Hard-wrap must not decide whether a rule is present.
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const THEATER = fs.readFileSync(
  path.join(FIXTURE_DIR, 'try-catch-theater.ts'),
  'utf8',
);
const CEREMONY = fs.readFileSync(
  path.join(FIXTURE_DIR, 'ceremony-wrapper.ts'),
  'utf8',
);

describe('vs-deslop: stays a code-cleanup skill', () => {
  it('keeps the Flow Contract, statuses, consumers, and result template', () => {
    expect(SKILL).toMatch(/## Flow Contract/);
    expect(SKILL).toMatch(/Building block/);
    expect(SKILL).toMatch(/`CLEAN`, `CLEANED`, `WARN`, `FAIL`, or `BLOCKED`/);
    expect(SKILL).toMatch(/vs:roast-code/);
    expect(SKILL).toMatch(/vs:build-it/);
    expect(SKILL).toMatch(/vs:ship-it/);
    expect(SKILL).toMatch(/## Deslop Result/);
    expect(SKILL).toMatch(/minimum-solution/);
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
  it('rejects try-catch theater from the fixture, not a slogan mention', () => {
    expect(THEATER).toMatch(/addNonThrowingPair/);
    expect(THEATER).toMatch(/\/\* theater \*\//);
    expect(SKILL).toMatch(
      /a file that matches test\/fixtures\/try-catch-theater\.ts fails the catalog/i,
    );
    expect(SKILL).not.toMatch(/addNonThrowingPair/);
    expect(SKILL).not.toMatch(/\/\* theater \*\//);
  });

  it('rejects ceremony wrappers from the fixture, not a slogan mention', () => {
    expect(CEREMONY).toMatch(/WidgetManager/);
    expect(CEREMONY).toMatch(/WidgetFactory\.ts/);
    expect(SKILL).toMatch(
      /a file that matches test\/fixtures\/ceremony-wrapper\.ts fails the catalog/i,
    );
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
      /`any` and an uncommented type assertion that fabricates evidence/i,
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
