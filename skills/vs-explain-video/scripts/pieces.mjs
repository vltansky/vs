// Pure plan for render.mjs --workers: split the frames into contiguous pieces,
// one per browser page, and check the counts add up. No I/O.
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
// Each worker is a full page render: half the cores, at most 3.
export const defaultWorkers = (cpus) => Math.max(1, Math.min(3, Math.floor(cpus / 2)));
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
