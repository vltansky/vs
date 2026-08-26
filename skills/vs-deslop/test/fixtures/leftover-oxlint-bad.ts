function addOne(n: number): number {
  return n + 1;
}

export function wrapAdd(n: number): number {
  return addOne(n);
}

export function rethrowAdd(n: number): number {
  try {
    return addOne(n);
  } catch (error) {
    throw error;
  }
}

type Extra = { a?: number };

export function mergeExtra(extra?: Extra) {
  return { a: 1, ...extra ?? {} };
}

export async function awaitLiteral(): Promise<number> {
  return await 1;
}

export function parseLoose(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    /* ignore */
  }
}
