import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('shape-it: interaction cadence', () => {
  it('runs interaction, independent shaping, then interaction', () => {
    const opening = SKILL.indexOf('### 1. Opening interaction');
    const independent = SKILL.indexOf('### 2. Independent shaping');
    const closing = SKILL.indexOf('### 3. Closing interaction');

    expect(opening).toBeGreaterThan(-1);
    expect(independent).toBeGreaterThan(opening);
    expect(closing).toBeGreaterThan(independent);
  });

  it('expects the user early and protects the independent middle from question drip', () => {
    expect(SKILL).toMatch(/assume the user is available and engaged/i);
    expect(SKILL).toMatch(/assume the user may be away until the closing\s+interaction/i);
    expect(SKILL).toMatch(/do not\s+drip follow-up questions/i);
  });

  it('requires explicit alignment before independent shaping', () => {
    const opening = SKILL.slice(
      SKILL.indexOf('### 1. Opening interaction'),
      SKILL.indexOf('### 2. Independent shaping'),
    );

    expect(opening).toMatch(/explicit alignment checkpoint/i);
    expect(opening).toMatch(/least-supported expensive-to-reverse assumption/i);
    expect(opening).toMatch(/explicitly asks for no questions/i);
    expect(opening).toMatch(/outcome,\s+boundary,\s+and proof of success/i);
  });

  it('distinguishes a guided interview from adversarial plan review', () => {
    const routing = SKILL.slice(
      SKILL.indexOf('## Route the input'),
      SKILL.indexOf('## Long-horizon shaping'),
    );
    const interview = SKILL.slice(
      SKILL.indexOf('#### Guided Explore interview'),
      SKILL.indexOf('```markdown'),
    );

    expect(routing).toMatch(/grill this plan.*Challenge/is);
    expect(routing).toMatch(/grill me.*question me.*Guided Explore/is);
    expect(interview).toMatch(/one consequential strategic question at a time/i);
    expect(interview).toMatch(/Accept `done`, `skip`, `back`, `\?`, and `eli5`/i);
    expect(interview).toMatch(/agent supplies facts, code reading, and recommendations/i);
  });

  it('gives guided exploration compact orientation without progress theater', () => {
    const interview = SKILL.slice(
      SKILL.indexOf('#### Guided Explore interview'),
      SKILL.indexOf('For either cadence'),
    );

    expect(interview).toMatch(
      /Align.*I shape.*You decide.*Handoff/is,
    );
    expect(interview).toMatch(/you-are-here/i);
    expect(interview).toMatch(/remaining/i);
    expect(interview).toMatch(/next decision/i);
    expect(interview).toMatch(/resolved.*open decisions/i);
    expect(interview).toMatch(/Do not show.*percentage.*time.*question count/is);
    expect(interview).toMatch(/Accept `done`, `skip`, `back`, `\?`, and `eli5`/i);
  });

  it('confirms the mental model before autonomy and ends with handoff readiness', () => {
    const opening = SKILL.slice(
      SKILL.indexOf('### 1. Opening interaction'),
      SKILL.indexOf('### 2. Independent shaping'),
    );
    const closing = SKILL.slice(
      SKILL.indexOf('### 3. Closing interaction'),
      SKILL.indexOf('## Confusion'),
    );

    expect(opening).toMatch(/mental model/i);
    expect(opening).toMatch(/no more than three bullets/i);
    expect(opening).not.toMatch(/fundamental.*ambiguous.*single confirmation/is);
    expect(opening).toMatch(/Do not add a fourth interview question/i);
    expect(closing).toMatch(/Goal Contract.*ready.*open decisions/is);
  });

  it('returns for approval with completed work and explicit strategic uncertainty', () => {
    expect(SKILL).toMatch(/Put the complete recommendation/i);
    expect(SKILL).toMatch(/in the linked files, not in chat/i);
    expect(SKILL).toMatch(/unresolved strategic/i);
    expect(SKILL).toMatch(/approval/i);
  });

  it('discovers operational context and keeps routing metadata subordinate to the design', () => {
    expect(SKILL).toMatch(/discover the active workspace, repository, and existing artifacts/i);
    expect(SKILL).toMatch(/ordinary navigation is not a strategic question/i);
    expect(SKILL).toMatch(/does not replace or\s+suppress the closing design/i);
  });

  it('gives every question a Why tldr of the user-world stake', () => {
    const opening = SKILL.slice(
      SKILL.indexOf('### 1. Opening interaction'),
      SKILL.indexOf('### 2. Independent shaping'),
    );
    expect(opening).toMatch(/\*\*Why:\*\*/);
    expect(opening).toMatch(/user-world stake if they pick\s+wrong/i);
    expect(opening).toMatch(/not a call to `\/vs-tldr`/);
  });

  it('ends every question with a stable Drill /vs-eli5 option', () => {
    const opening = SKILL.slice(
      SKILL.indexOf('### 1. Opening interaction'),
      SKILL.indexOf('### 2. Independent shaping'),
    );
    expect(opening).toMatch(/D\. Drill — `\/vs-eli5` this\s+tradeoff/);
    expect(opening).toMatch(/last option, same label/);
    expect(opening).toMatch(/Always include Drill \(`eli5`\) as the last option/i);
    expect(opening).toMatch(/`1D` or `eli5` drills that question/);
    expect(opening).toMatch(/eli5` drills this question's tradeoff with `\/vs-eli5`/);
  });

  it('does not auto-open eli5 on a question unless they pick Drill', () => {
    const opening = SKILL.slice(
      SKILL.indexOf('### 1. Opening interaction'),
      SKILL.indexOf('### 2. Independent shaping'),
    );
    expect(opening).toMatch(/Do not open it unless they\s+pick Drill/i);
    expect(opening).toMatch(/Compose `\/vs-eli5` on that question's tradeoff only if they pick it/i);
  });

  it('stops Guided Explore after one expensive call, not every expensive choice', () => {
    const interview = SKILL.slice(
      SKILL.indexOf('#### Guided Explore interview'),
      SKILL.indexOf('For either cadence'),
    );
    expect(interview).toMatch(/outcome, boundary, and one expensive-to-reverse\s+call/i);
    expect(interview).toMatch(/stated reversible default in the spec/i);
    expect(interview).toMatch(/Keep Why \+\s+Drill as the last option/i);
    expect(interview).not.toMatch(/expensive-to-reverse choices are clear/i);
    expect(interview).not.toMatch(/Stop interviewing once outcome, boundary, success proof/i);
    expect(interview).toMatch(/Do not keep grilling until all expensive choices are clear/i);
  });
});
