import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  artifactToolRegistryFactory,
  resolveQuoteStart,
  reviewOverlayCss,
  reviewStorageKey,
  reviewToolFactory,
} from '../assets/review-overlay.mjs';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const REVIEW_SOURCE = fs.readFileSync(
  path.join(SKILL_DIR, 'assets', 'review-overlay.mjs'),
  'utf8',
);
const REVIEW_FACTORY_SOURCE = REVIEW_SOURCE.slice(
  REVIEW_SOURCE.indexOf('export function reviewOverlayFactory') + 'export '.length,
).trim();
const TEMPLATES = ['artifact.html', 'proposal.html'].map((name) => ({
  name,
  source: fs.readFileSync(path.join(SKILL_DIR, 'assets', name), 'utf8'),
}));

describe('the local review overlay is one portable generated shell feature', () => {
  it('isolates artifacts independently of their served URL', () => {
    const href = 'http://127.0.0.1:8878/report.html?v=2#decision';
    expect(reviewStorageKey('018f4f6c-65cc-7d4d-89f7-c93d179ebd67', href)).toBe(
      'vs-review:artifact:018f4f6c-65cc-7d4d-89f7-c93d179ebd67',
    );
    expect(reviewStorageKey('018f4f6c-65cc-7d4d-89f7-c93d179ebd68', href)).not.toBe(
      reviewStorageKey('018f4f6c-65cc-7d4d-89f7-c93d179ebd67', href),
    );
    expect(reviewStorageKey('', href)).toBe('vs-review:http://127.0.0.1:8878/report.html?v=2');
    expect(reviewStorageKey('', href)).not.toBe(
      reviewStorageKey('', 'http://127.0.0.1:8878/report.html?v=3#decision'),
    );
  });

  it.each(TEMPLATES)('$name inlines the review source and registers comment tools', ({ source }) => {
    const block = source.match(/\/\/ vs-review:begin[\s\S]*?\/\/ vs-review:end/)?.[0] ?? '';
    expect(source).toContain('<meta name="vs-artifact-id" content="[[ARTIFACT_ID]]" />');
    expect(block).toContain(reviewOverlayCss);
    // Read the raw source because Vitest rewrites function declarations during
    // import, while the generator runs under plain Node and inlines them verbatim.
    expect(block).toContain(REVIEW_FACTORY_SOURCE);
    expect(block).toContain(`const reviewStorageKey = ${reviewStorageKey.toString()};`);
    expect(block).toContain('reviewOverlayFactory(reviewOverlayCss, resolveQuoteStart, reviewToolFactory, artifactToolRegistryFactory, reviewStorageKey);');
    expect(source).toContain('document.modelContext');
    expect(source).toContain("name: 'list_review_comments'");
    expect(source).toContain("name: 'add_review_comment'");
    expect(source).toContain("name: 'resolve_review_comment'");
    expect(source).toContain('artifactToolRegistryFactory');
    expect(source).toContain('window.vsArtifact');
    expect(source).not.toContain('read_htmdx_artifact');
    expect(source.match(/<script\s[^>]*type="text\/htmdx"/g)).toHaveLength(1);
  });

  it('uses the artifact reading face and reserves mono for metadata', () => {
    expect(reviewOverlayCss).toMatch(/\.vs-review-surface[^}]*font-family:\s*'Figtree'/);
    expect(reviewOverlayCss).toMatch(/\.vs-review-thread-head[^}]*'JetBrains Mono'/);
    expect(reviewOverlayCss).not.toMatch(/:host[^}]*font-family/);
  });

  it('offers explicit remove and simplify requests for selected text', () => {
    expect(REVIEW_SOURCE).toContain('data-intent="remove"');
    expect(REVIEW_SOURCE).toContain('data-intent="simplify"');
    expect(REVIEW_SOURCE).toContain('>Remove</button>');
    expect(REVIEW_SOURCE).toContain('>What?</button>');
    expect(REVIEW_SOURCE).toContain("['remove', 'Remove this.']");
    expect(REVIEW_SOURCE).toContain("['simplify', \"I don't understand this. Rewrite it for someone new to the topic. Lead with the main point. Use familiar words and short sentences. Explain necessary terms. Make any action or recommendation concrete. Keep the original meaning, facts, and important details.\"]");
    expect(REVIEW_SOURCE).toContain('vs-review-removal-layer');
    expect(REVIEW_SOURCE).toContain('renderRemovals()');
    expect(REVIEW_SOURCE).toContain('vs-review-question-layer');
    expect(REVIEW_SOURCE).toContain('renderQuestions()');
    expect(REVIEW_SOURCE).toContain('rect.right + 32 <= innerWidth ? rect.right + 14 : rect.right - 32');
  });

  it('keeps action state and refresh work honest', () => {
    expect(REVIEW_SOURCE).toContain('data-primary="true" type="submit" disabled');
    expect(REVIEW_SOURCE).toContain("listen(textarea, 'input'");
    expect(REVIEW_SOURCE).toContain("submitButton.disabled = textarea.value.trim() === ''");
    expect(REVIEW_SOURCE).toContain("count.textContent = openCount === 0 ? '' : String(openCount)");
    const refresh = REVIEW_SOURCE.match(/function scheduleRefresh\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(refresh.match(/renderMarkers\(\)/g)).toHaveLength(1);
  });

  it('keeps comment creation quiet and explains the agent pull step', () => {
    expect(REVIEW_SOURCE).toContain('After adding, send the agent a message to read comments.');
    expect(REVIEW_SOURCE).toContain('Comments are not checked automatically.');
    const submit = REVIEW_SOURCE.match(/listen\(composer, 'submit'[\s\S]*?\n  \}\);/)?.[0] ?? '';
    const quickFeedback = REVIEW_SOURCE.match(/function addSelectionFeedback[\s\S]*?\n  \}/)?.[0] ?? '';
    const toolAdd = REVIEW_SOURCE.match(/function addReviewComment[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(submit).toContain('setPanel(false)');
    expect(quickFeedback).toContain('setPanel(false)');
    expect(toolAdd).not.toContain('setPanel(true)');
  });

  it('documents the local-only persistence boundary and human-first workflow', () => {
    expect(SKILL).toMatch(/select text[\s\S]{0,360}comment on an element/i);
    expect(SKILL).toMatch(/localStorage/);
    expect(SKILL).toMatch(/new UUID[\s\S]{0,160}`vs-artifact-id`/i);
    expect(SKILL).toMatch(/preserve[\s\S]{0,100}`vs-artifact-id`/i);
    expect(SKILL).toMatch(/artifact ID[\s\S]{0,240}do not\s+travel with the HTML/i);
    expect(SKILL).toContain('`list_review_comments`');
    expect(SKILL).toContain('`add_review_comment`');
    expect(SKILL).toContain('`resolve_review_comment`');
    expect(SKILL).toMatch(/do not trigger an agent turn[\s\S]{0,180}send the agent a message/i);
    expect(SKILL).toMatch(/\*\*Remove\*\*[\s\S]{0,180}remov/i);
    expect(SKILL).toMatch(/\*\*What\?\*\*[\s\S]{0,180}plain-language/i);
    expect(SKILL).toMatch(/simplify[\s\S]{0,260}vs-write[\s\S]{0,180}Direct mode/i);
    expect(SKILL).toContain('window.vsArtifact.registerTool');
    expect(SKILL).toContain('`htmdx:rendered`');
    expect(SKILL).toMatch(/human control[\s\S]{0,240}same handler/i);
    expect(SKILL).not.toContain('read_htmdx_artifact');
  });
});

describe('artifact-authored WebMCP tools use one lifecycle-aware registry', () => {
  it('registers arbitrary tools and aborts them with their artifact', async () => {
    const parent = new AbortController();
    let registered;
    const registry = artifactToolRegistryFactory({
      registerTool: (tool, options) => { registered = { tool, options }; return Promise.resolve(); },
    }, parent.signal);
    const tool = { name: 'choose_retry_policy', execute: ({ choice }) => ({ choice }) };
    const registration = registry.registerTool(tool);
    expect(registration.available).toBe(true);
    await registration.ready;
    expect(registered.tool).toBe(tool);
    expect(registered.options.signal.aborted).toBe(false);
    parent.abort();
    expect(registered.options.signal.aborted).toBe(true);
  });

  it('keeps authored controls usable when WebMCP is unavailable', async () => {
    const registration = artifactToolRegistryFactory(undefined).registerTool({ name: 'choose_retry_policy' });
    expect(registration.available).toBe(false);
    await expect(registration.ready).resolves.toBeUndefined();
  });
});

describe('WebMCP comment tools reuse the human review state', () => {
  it('lists, adds, and resolves through one review API', async () => {
    const calls = [];
    const tools = reviewToolFactory({
      list: () => [{ id: 'c1', comment: 'Current', status: 'open' }],
      add: (input) => { calls.push(['add', input]); return { id: 'c2', status: 'open' }; },
      resolve: (input) => { calls.push(['resolve', input]); return { id: input.id, status: input.resolved ? 'resolved' : 'open' }; },
    });
    expect(tools.map(({ name }) => name)).toEqual([
      'list_review_comments', 'add_review_comment', 'resolve_review_comment',
    ]);
    expect(tools[0].annotations).toMatchObject({ readOnlyHint: true });
    expect(await tools[0].execute({})).toEqual({ comments: [{ id: 'c1', comment: 'Current', status: 'open' }] });
    expect(await tools[1].execute({ comment: 'Agent note', selector: 'h2' })).toEqual({ id: 'c2', status: 'open' });
    expect(await tools[2].execute({ id: 'c1', resolved: true })).toEqual({ id: 'c1', status: 'resolved' });
    expect(calls).toEqual([
      ['add', { comment: 'Agent note', selector: 'h2' }],
      ['resolve', { id: 'c1', resolved: true }],
    ]);
  });
});

describe('quote fallback refuses ambiguous anchors', () => {
  it('uses prefix and suffix context to select one repeated quote', () => {
    expect(
      resolveQuoteStart('alpha same omega / beta same gamma', {
        exact: 'same',
        prefix: 'beta ',
        suffix: ' gamma',
      }),
    ).toBe(24);
  });

  it('returns null when repeated text has no distinguishing context', () => {
    expect(resolveQuoteStart('same / same', { exact: 'same', prefix: '', suffix: '' })).toBeNull();
  });
});
