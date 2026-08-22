export function addNonThrowingPair(left: number, right: number): number {
  try {
    return left + right;
  } catch {
    /* theater */
  }
  return 0;
}
