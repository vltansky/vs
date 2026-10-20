import { describe, expect, it } from 'vitest';
import { checkMediaPairs } from '../scripts/pr-media-pairs.mjs';

const proof = { body: '', images: 2, videos: 2, frontend: true, functional: true };
describe('required UI media pairs', () => {
  it('requires both screenshot and video pairs for functional behavior', () => {
    expect(checkMediaPairs(proof).ok).toBe(true);
    expect(checkMediaPairs({ ...proof, images: 1 }).ok).toBe(false);
    expect(checkMediaPairs({ ...proof, videos: 1 }).ok).toBe(false);
    expect(checkMediaPairs({ ...proof, images: 0, videos: 4 }).ok).toBe(false);
    expect(checkMediaPairs({ ...proof, images: 4, videos: 0 }).ok).toBe(false);
  });
  it('requires screenshots but no video for a static visual change', () => {
    expect(checkMediaPairs({ ...proof, functional: false, videos: 0 }).ok).toBe(true);
    expect(checkMediaPairs({ ...proof, functional: false, images: 0 }).ok).toBe(false);
  });
  it('only accepts the missing media kind’s exact stated blocker', () => {
    const missing = { ...proof, images: 0, videos: 0 };
    expect(checkMediaPairs({ ...missing, body: '**Still unverified:** endpoint response; no preview' }).ok).toBe(false);
    expect(checkMediaPairs({ ...missing, body: '**Still unverified:** screenshots; no baseline' }).ok).toBe(false);
    expect(checkMediaPairs({ ...missing, body: '**Still unverified:** screenshots; no baseline\n**Still unverified:** video; browser denied' }).ok).toBe(true);
    expect(checkMediaPairs({ ...missing, body: '**Still unverified:** video;' }).ok).toBe(false);
  });
  it('does not demand video for a non-UI contract change or unchanged visible output', () => {
    expect(checkMediaPairs({ ...proof, frontend: false, images: 0, videos: 0 }).ok).toBe(true);
    expect(checkMediaPairs({ ...proof, images: 0, videos: 0, body: 'No visual change: shared request parsing only.' }).ok).toBe(true);
  });
});
