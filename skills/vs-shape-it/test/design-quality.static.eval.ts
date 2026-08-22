import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('shape-it: design quality', () => {
  it(
    'prioritizes problem, boundary, and kill-criterion questions without asking by rote',
    () => {
      const opening = SKILL.slice(
        SKILL.indexOf('### 1. Opening interaction'),
        SKILL.indexOf('### 2. Independent shaping'),
      );

      expect(opening).toMatch(/problem.*outcome/i);
      expect(opening).toMatch(/system boundary.*ownership/i);
      expect(opening).toMatch(/kill criterion.*not worth building/i);
      expect(opening).toMatch(/do not ask all three by rote/i);
    },
  );

  it('covers failure behavior when the design crosses a runtime boundary', () => {
    const design = SKILL.slice(
      SKILL.indexOf('#### Design\n'),
      SKILL.indexOf('#### Record the decision'),
    );

    expect(design).toMatch(
      /failure modes,\s+degradation\/recovery,\s+and ownership/i,
    );
    expect(design).toMatch(/runtime or operational boundar/i);
  });

  it('self-reviews the integrated design after pushback and before closing', () => {
    const strategy = SKILL.indexOf('#### Design the execution strategy');
    const pushback = SKILL.indexOf('#### Stress-test with pushback');
    const review = SKILL.indexOf('#### Self-review the design');
    const closing = SKILL.indexOf('### 3. Closing interaction');
    const reviewText = SKILL.slice(review, closing);

    expect(pushback).toBeGreaterThan(strategy);
    expect(review).toBeGreaterThan(pushback);
    expect(closing).toBeGreaterThan(review);
    expect(reviewText).toMatch(/TBD,\s+TODO,\s+placeholder/i);
    expect(reviewText).toMatch(/internal consistency/i);
    expect(reviewText).toMatch(/scope check/i);
    expect(reviewText).toMatch(/ambiguity check/i);
  });

  it('closes with a saved vs-eli5, never auto-opened', () => {
    const closing = SKILL.slice(SKILL.indexOf('### 3. Closing interaction'));
    expect(closing).toMatch(/always compose/i);
    expect(SKILL).toMatch(/Challenge hands the whole\s+session to pushback in interactive mode/);
    expect(SKILL).toMatch(/pushback composes the close-time\s+`\/vs-eli5`/);
    expect(closing).toMatch(/\/vs-eli5/);
    expect(closing).toMatch(/Do not auto-open/i);
    expect(closing).toMatch(/Do not run `open` or `xdg-open`/i);
    expect(closing).not.toMatch(/open that `\.html` immediately/i);
    expect(closing).not.toMatch(/open "\$ARTIFACT_PATH"/);
    expect(closing).not.toMatch(/2\. The opened eli5/);
    expect(closing).toMatch(/2\. The eli5 file path \(or .eli5 saved.\)/);
    expect(closing).toMatch(/Do not skip the eli5/);
    expect(closing).toMatch(/short picture review of that spec/);
    expect(closing).toMatch(/so the user can confirm it/);
    expect(closing).toMatch(/Do not treat the eli5 as a replacement contract/);
    expect(closing).toMatch(/Do not paste\s+the Goal Contract/);
    expect(closing).toMatch(/Chat is only this exclusive 4-item close, in this order/);
    expect(closing).toMatch(/1\. The first sentence is the TLDR/);
    expect(closing).toMatch(/Do not write a second TLDR/);
    expect(closing).toMatch(/3\. Verdict-honest Handoff/);
    expect(closing).toMatch(
      /READY or READY_WITH_RISKS:\s*`Handoff: Goal Contract ready \| <N> open decisions`/,
    );
    const notReadyHandoff = closing.match(/NOT_READY:\s*`Handoff:[^`]+`/)?.[0] ?? '';
    expect(notReadyHandoff).toMatch(/Handoff: Goal Contract blocked/i);
    expect(notReadyHandoff).not.toMatch(/Goal Contract ready/i);
    expect(closing).toMatch(/Never write `Goal Contract ready` on a NOT_READY close/);
    expect(closing).toMatch(/4\. One `Your action`/);
    expect(closing).not.toMatch(/follow\s+explanation-surfaces/i);
    expect(closing).toMatch(
      /Display: save the eli5 HTML and put its path \(or .eli5 saved.\) in close item 2 as a link; do not auto-open, and do not run `open` or `xdg-open` unless the user picked Drill mid-session or later asks to open the file\./,
    );
    expect(closing).toMatch(/Cite .*explanation-surfaces\.md.*only for chat TLDR vs artifact/s);
    expect(closing).not.toMatch(/Chat carries only the TLDR, the opened artifact, and the confirm/);
    expect(closing).not.toMatch(/the close leads with the blocking finding/);
    expect(closing).toMatch(/Do not print it in chat/);
    expect(closing).toMatch(/Write that block in the spec/);
    expect(closing).toMatch(/required even when that\s+complexity test would keep the answer in chat/);
    expect(SKILL).toMatch(/\*\*Relevant:\*\*.*\/vs-eli5/);
    expect(SKILL).toMatch(/short review of the spec so the user can confirm it/);
  });
});
