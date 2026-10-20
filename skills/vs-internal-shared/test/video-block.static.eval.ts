import { describe, expect, it } from 'vitest';

import { findVideoBlocks, keepVideoBlock, stripVideoBlocks, upsertVideoBlock, VIDEO_END, VIDEO_START } from '../scripts/video-block.mjs';

// One parser for the <!-- vs:video --> block, shared by pr-media-gate, attach.mjs,
// and ship-it's body refresh.

const block = (label: string) => `${VIDEO_START}\n<details>\n<summary>Video explainer (${label})</summary>\n\nhttps://github.com/user-attachments/assets/${label}\n\n</details>\n${VIDEO_END}`;
const WALK = '<details>\n<summary>Walkthrough: 1 area, 1 file</summary>\n\nw\n\n</details>\n';
const fence = (text: string) => `\`\`\`markdown\n${text}\n\`\`\``;

describe('video-block.mjs', () => {
  it('ignores markers in a code fence and in inline code', () => {
    const body = `Intro with a \`${VIDEO_START}\` quote.\n\n${fence(block('example'))}\n\n${WALK}`;
    expect(findVideoBlocks(body)).toEqual([]);
    expect(stripVideoBlocks(body)).toBe(body);
    const out = upsertVideoBlock(body, block('real'));
    expect(out.indexOf(block('real'))).toBeGreaterThan(out.indexOf('```\n\n'));
    expect(out.indexOf(block('real'))).toBeLessThan(out.indexOf('Walkthrough: 1 area'));
    expect(out).toContain(fence(block('example')));
  });

  it('turns a lone opener into one block without swallowing the Walkthrough', () => {
    const bare = `Intro\n\n${VIDEO_START}\n\n${WALK}`;
    expect(findVideoBlocks(bare)).toMatchObject([{ kind: 'open', text: VIDEO_START }]);
    const out = upsertVideoBlock(bare, block('new'));
    expect(out).toBe(`Intro\n\n${block('new')}\n\n${WALK}`);
    expect(upsertVideoBlock(out, block('new'))).toBe(out);
  });

  it('replaces a lone opener with its old explainer, and drops duplicates and a stray closer', () => {
    const half = `Intro\n\n${block('old').replace(`\n${VIDEO_END}`, '')}\n\nmid\n\n${block('dup')}\n\n${VIDEO_END}\n\n${WALK}`;
    const out = upsertVideoBlock(half, block('new'));
    expect(out.match(/<!-- vs:video -->/g)).toHaveLength(1);
    expect(out.match(/<!-- \/vs:video -->/g)).toHaveLength(1);
    expect(out).not.toMatch(/assets\/(old|dup)/);
    expect(out).toContain('mid');
    expect(out).toContain('Walkthrough: 1 area');
  });

  it('keeps the live block in a refreshed body, and leaves a body with none alone', () => {
    const live = `Old text\n\n${block('live')}\n\n${WALK}`;
    const fresh = `New text\n\n${WALK}`;
    expect(keepVideoBlock(fresh, live)).toBe(`New text\n\n${block('live')}\n\n${WALK}`);
    expect(keepVideoBlock(fresh, 'no video yet')).toBe(fresh);
    expect(keepVideoBlock(keepVideoBlock(fresh, live), live)).toBe(keepVideoBlock(fresh, live));
  });
  it('puts the block before the Walkthrough when a stray marker sits after it, and a rerun changes nothing', () => {
    const stray = `Intro\n\n${WALK}\n${VIDEO_END}\n`;
    const out = upsertVideoBlock(stray, block('new'));
    expect(out.indexOf(block('new'))).toBeLessThan(out.indexOf('Walkthrough: 1 area'));
    expect(out.match(/<!-- \/vs:video -->/g)).toHaveLength(1);
    expect(upsertVideoBlock(out, block('new'))).toBe(out);
    const late = `Intro\n\n${WALK}\n${block('old')}\n\ntail\n`;
    const moved = upsertVideoBlock(late, block('new'));
    expect(moved).toBe(`Intro\n\n${block('new')}\n\n${WALK}\ntail\n`);
    expect(upsertVideoBlock(moved, block('new'))).toBe(moved);
  });
});
