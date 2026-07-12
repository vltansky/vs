let hits = 0;
let misses = 0;

export function recordHit(): void {
  hits++;
}

export function recordMiss(): void {
  misses++;
}

export function snapshot(): { hits: number; misses: number; hitRate: number } {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRate: total === 0 ? 0 : hits / total,
  };
}
