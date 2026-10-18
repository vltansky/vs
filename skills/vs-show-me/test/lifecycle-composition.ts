/** Machine owns the state-screen layout since #85; score its model rather than Tailwind implementation details. */
export function hasLifecycleMachine(source: string): boolean {
  const body = source.match(/<Machine\b[^>]*>([\s\S]*?)<\/Machine>/)?.[1];
  if (!body) return false;
  const states = new Set([...body.matchAll(/^- state (\S+)(?: final)?:/gm)].map((match) => match[1]));
  const screens = new Map([...body.matchAll(/^- screen (\S+):\s*(.+)$/gm)].map((match) => [match[1], match[2]]));
  const edges = new Set([...body.matchAll(/^- (\S+) -> (\S+):/gm)].map((match) => `${match[1]}->${match[2]}`));
  const success = ['succeeded', 'success', 'completed'].find((state) => states.has(state));
  if (!success) return false;
  return ['queued', 'running', success, 'failed'].every((state) => states.has(state) && screens.has(state))
    && [`queued->running`, `running->${success}`, 'running->failed', 'failed->running'].every((edge) => edges.has(edge))
    && /3\s*(?:of|\/)\s*5/.test(screens.get('running') ?? '')
    && /error/i.test(screens.get('failed') ?? '')
    && /retry/i.test(screens.get('failed') ?? '');
}
