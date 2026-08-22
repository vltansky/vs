import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
// Hard-wrap must not decide whether a rule is present.
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');

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

describe('vs-deslop: peer-skill code rules that were missing', () => {
  it('collects candidates and discards false positives before editing', () => {
    expect(SKILL).toMatch(/collect candidates\.? do not edit yet/i);
    expect(SKILL).toMatch(/false positive/i);
    expect(SKILL).toMatch(/necessary defense/i);
    expect(SKILL).toMatch(/discard (it|the candidate|false positives?)/i);
  });

  it('rescans the catalog before reporting CLEAN or CLEANED', () => {
    expect(SKILL).toMatch(/re-?(scan|walk) the (cleanup )?catalog/i);
    expect(SKILL).toMatch(/before reporting `?(CLEAN|CLEANED)/i);
  });

  it('forbids cleanup that adds machinery', () => {
    expect(SKILL).toMatch(
      /must not add a (new )?(file|wrapper|interface|flag|helper)[\s\S]{0,80}that did not exist/i,
    );
  });

  it('applies a portability test to generic helpers', () => {
    expect(SKILL).toMatch(/portability test/i);
    expect(SKILL).toMatch(
      /could (be moved|move) to (any )?another (repo|codebase|product)/i,
    );
  });

  it('treats try/catch theater as slop', () => {
    expect(SKILL).toMatch(/try\/catch/i);
    expect(SKILL).toMatch(/non-throwing/i);
    expect(SKILL).toMatch(/empty catch|swallow/i);
  });

  it('treats silent defaults and optional chains as hidden failures', () => {
    expect(SKILL).toMatch(/optional chaining|\?\./);
    expect(SKILL).toMatch(/\?\? \[\]|\?\? \{\}|silent default/i);
  });

  it('rejects ceremony wrappers and single-use extracts', () => {
    expect(SKILL).toMatch(/single-use/);
    expect(SKILL).toMatch(/Manager|Factory|Utils/);
    expect(SKILL).toMatch(/boolean (mode )?flag/i);
  });

  it('cuts hand-holding comments and signature-restating JSDoc', () => {
    expect(SKILL).toMatch(/JSDoc/i);
    expect(SKILL).toMatch(/hand-holding/i);
    expect(SKILL).toMatch(/restat(e|ing) the signature/i);
  });

  it('does not flatten local idiom', () => {
    expect(SKILL).toMatch(/local idiom/i);
    expect(SKILL).toMatch(
      /flatten(ing)? (working )?(house style|local idiom)/i,
    );
  });

  it('names any and uncommented assertions', () => {
    expect(SKILL).toMatch(/`any`/);
    expect(SKILL).toMatch(/uncommented (type )?assertion/i);
  });

  it('keeps synonym cycling of domain names out', () => {
    expect(SKILL).toMatch(/synonym cycling|same (domain )?concept/i);
    expect(SKILL).toMatch(/rotat(e|ing) (the )?name/i);
  });

  it('quick-checks leftover console and TODO fossils', () => {
    expect(SKILL).toMatch(/TODO fossil|stale TODO/i);
    expect(SKILL).toMatch(/console\.(log|debug|info)/i);
  });

  it('stops only when no concept is still cuttable', () => {
    expect(SKILL).toMatch(/density-?stop/i);
    expect(SKILL).toMatch(/still cuttable/i);
    expect(SKILL).toMatch(
      /do not report `CLEAN` or `CLEANED` while an in-scope tell remains/i,
    );
  });
});
