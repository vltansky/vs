import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { predictionComponentFactory } from '../assets/prediction.mjs';

const react = { createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({ type, props, children }) };
const component = predictionComponentFactory(react);
const text = (element: unknown) => JSON.stringify(element);

describe('Prediction preserves the teaching contract across renderers', () => {
  it('shows an explicit error rather than teaching an answer outside the choices', () => {
    const result = component.Component({ choices: 'Cache,Server', body: '- Expired: Wrong | Invented result.' });
    expect(text(result)).toContain('alert');
    expect(text(result)).toContain('exact choice');
    expect(text(result)).not.toContain('Invented result');
  });

  it('rejects duplicate setups and ambiguous answer choices', () => {
    expect(text(component.Component({ choices: 'Cache,Cache', body: '- Fresh: Cache | Reuse.' }))).toContain('distinct');
    expect(text(component.Component({ choices: 'Cache,Server', body: '- Same: Cache | Reuse.\n- Same: Server | Fetch.' }))).toContain('uniquely named');
  });

  it('keeps all answers and reasons in the static render', () => {
    const result = component.Component({ question: 'Where next?', choices: 'Cache,Server', body: '- Fresh: Cache | Still fresh.\n- Expired: Server | Lifetime ended.' });
    expect(text(result)).toContain('Fresh: Cache — Still fresh.');
    expect(text(result)).toContain('Expired: Server — Lifetime ended.');
    expect(text(result)).not.toContain('alert');
  });

  it('inlines the identical implementation in both portable template shells', async () => {
    const source = readFileSync(new URL('../assets/prediction.mjs', import.meta.url), 'utf8');
    const original = source.slice(source.indexOf('export const predictionComponentFactory')).replace(/^export /, '').trim();
    for (const file of ['artifact.html', 'proposal.html']) {
      const shell = readFileSync(new URL(`../assets/${file}`, import.meta.url), 'utf8');
      expect(shell).toContain(original);
    }
  });
});
