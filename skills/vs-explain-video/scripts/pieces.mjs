// Pure plan for render.mjs --workers: split the frames into contiguous pieces,
// one per browser page, and check the counts and the piece boundaries. No I/O.
//
// Idea from take-one's render-parallel.sh (github.com/talsiach/take-one, MIT);
// this code is our own.

// Every frame exactly once, in order, sizes differing by at most one.
export const planPieces = (frames, workers) => {
  const n = Math.max(1, Math.min(Math.floor(workers) || 1, frames));
  const base = Math.floor(frames / n);
  const extra = frames % n;
  let first = 0;
  return Array.from({ length: n }, (_, index) => {
    const count = base + (index < extra ? 1 : 0);
    const piece = { index, first, count };
    first += count;
    return piece;
  });
};
// Each worker is a full page render: one core left free, at most 3.
export const defaultWorkers = (cpus) => Math.max(1, Math.min(3, Math.floor(cpus) - 1));
// Frame-count parity: each piece holds what it was planned to hold, and the
// joined video holds every frame.
export const frameParity = (pieces, counted, joined) => {
  const problems = pieces
    .map((piece, i) => (counted[i] === piece.count ? null : `piece ${piece.index} has ${counted[i]} frames, planned ${piece.count}`))
    .filter(Boolean);
  const total = pieces.reduce((sum, piece) => sum + piece.count, 0);
  if (joined !== total) problems.push(`the joined video has ${joined} frames, planned ${total}`);
  return { ok: problems.length === 0, problems };
};
// Boundary parity: piece k starts on a cold page. The page of piece k-1 has
// drawn every frame before it, as a 1-worker render would, so it draws piece
// k's first frame once more as the reference. checks: one per boundary,
// { frame, equal, psnr, changed } (psnr and changed, the pixels off by more
// than 32/255, only when the bytes differ). The two match when the bytes do,
// or when the difference is encoder noise: above 45 dB and under 64 changed
// pixels, so one changed word in a card still fails. A frame that draws
// differently cold is state leaking from frame to frame: the pieces would not
// match a 1-worker render.
export const BOUNDARY = { psnr: 45, noisePx: 32, area: 64 };
export const boundaryParity = (checks) => {
  const problems = checks
    .filter(({ equal, psnr, changed }) => !equal && !(psnr > BOUNDARY.psnr && changed < BOUNDARY.area))
    .map(({ frame, psnr, changed }) => `frame ${frame} draws differently on a cold page than after the frames before it (${Number.isFinite(psnr) ? psnr.toFixed(1) : psnr} dB, ${changed} px changed): scenes.js keeps state between frames`);
  return { ok: problems.length === 0, problems };
};
// Pixels of two grey frames of equal size that differ by more than noisePx.
export const changedPixels = (a, b, threshold = BOUNDARY.noisePx) => {
  if (a.length !== b.length || a.length === 0) throw new Error('frames differ in size');
  let n = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > threshold) n += 1;
  return n;
};
