import { App } from '@modelcontextprotocol/ext-apps';
import { artifactToolRegistryFactory, resolveQuoteStart, reviewOverlayCss, reviewOverlayFactory, reviewStorageKey, reviewToolFactory } from '../skills/vs-show-me/assets/review-overlay.mjs';
import { installReviewBridge } from './review-bridge.ts';
import { z } from 'zod';
import { commentsSchema, librarySchema, savedArtifactSchema, savedCommentSchema, presentationSchema, reviewMessageSchema, type Library, type SavedArtifact, type ToolArguments, type ReviewReply } from './contracts.ts';

const element = <T extends HTMLElement,>(selector: string) => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`VS App is missing ${selector}.`);
  return node;
};
const frame = element<HTMLIFrameElement>('#vs-artifact-frame');
const status = element('#status');
const catalog = element('#catalog');
const filters = element<HTMLFormElement>('#filters');
const search = element<HTMLInputElement>('#search');
const project = element<HTMLSelectElement>('#project');
const more = element<HTMLButtonElement>('#more');
const back = element<HTMLButtonElement>('#back');
const refresh = element<HTMLButtonElement>('#refresh');
const app = new App({ name: 'VS artifacts', version: '1.0.0' });
const controller = new AbortController();
const { signal } = controller;
let selected: SavedArtifact | undefined;
let frameSession: string;
let nextOffset: number | null = null;
let generation = 0;
let debounce: ReturnType<typeof setTimeout>;
const showStatus = (message: string) => { status.textContent = message; status.hidden = !message; };

async function call<T>(name: string, args: ToolArguments, schema: z.ZodType<T>) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content.filter(c => c.type === 'text').map(c => c.text).join(' ') || 'VS request failed.');
  return schema.parse(result.structuredContent);
}

function showLibrary(data: Library, append = false) {
  selected = undefined;
  frame.hidden = true;
  frame.removeAttribute('srcdoc');
  filters.hidden = catalog.hidden = false;
  back.hidden = true;
  refresh.hidden = false;
  element('#title').textContent = 'Artifact library';
  element('#subtitle').textContent = `${data.total} saved artifact${data.total === 1 ? '' : 's'}`;
  if (!append) catalog.replaceChildren();
  const previousProject = project.value;
  project.replaceChildren(new Option('All projects', ''), ...data.projects.map(p => new Option(p, p)));
  project.value = previousProject;
  for (const artifact of data.artifacts) {
    const button = document.createElement('button');
    button.className = 'artifact';
    const summary = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = artifact.title;
    const detail = document.createElement('small');
    detail.textContent = `${artifact.project} / ${artifact.path.split('/').at(-1)} · ${new Date(artifact.updatedAt).toLocaleDateString()}`;
    summary.append(title, detail);
    const feedback = document.createElement('span');
    feedback.className = 'feedback';
    feedback.textContent = `${artifact.openComments} open · View →`;
    button.append(summary, feedback);
    button.addEventListener('click', () => { void openArtifact(artifact.id); }, { signal });
    catalog.append(button);
  }
  if (!data.total) {
    const empty = document.createElement('p');
    empty.id = 'empty';
    empty.textContent = search.value || project.value ? 'No matching artifacts. Try another search or project.' : 'No saved artifacts yet. Create a VS show-me or eli5 artifact, then refresh.';
    catalog.append(empty);
  }
  nextOffset = data.nextOffset;
  more.hidden = nextOffset === null;
  showStatus('');
}

async function loadLibrary(append = false) {
  const request = ++generation;
  more.disabled = true;
  showStatus('Loading artifacts…');
  try {
    const data = await call('vs.library', { query: search.value, project: project.value || undefined, offset: append ? nextOffset : 0 }, librarySchema);
    if (request === generation) showLibrary(data, append);
  } catch (error) { if (request === generation) showStatus(`${error instanceof Error ? error.message : 'Library unavailable.'} Use Refresh to try again.`); }
  finally { if (request === generation) more.disabled = false; }
}

// Refresh the generated review overlay in the displayed copy only. Older portable
// artifacts gain the bridge without rewriting their authored source or scripts.
function reviewHtml(html: string, session: string) {
  // Explicit bindings survive bundler renaming; serialized declarations alone
  // would keep minified function names and leave the bootstrap's calls undefined.
  const functions = { resolveQuoteStart, reviewStorageKey, reviewToolFactory, artifactToolRegistryFactory, reviewOverlayFactory };
  const bootstrap = `(()=>{(${installReviewBridge.toString()})(${JSON.stringify(session)});const reviewOverlayCss=${JSON.stringify(reviewOverlayCss)};${Object.entries(functions).map(([name, fn]) => `const ${name}=${fn.toString()};`).join('\n')}\nreviewOverlayFactory(reviewOverlayCss,resolveQuoteStart,reviewToolFactory,artifactToolRegistryFactory,reviewStorageKey);})();`;
  const script = `<script>${bootstrap.replace(/<\/script/gi, '<\\/script')}</script>`;
  const generated = /<script>\s*\/\/ vs-(?:webmcp:begin[\s\S]*?webmcp:end|review:begin[\s\S]*?review:end)\s*<\/script>/;
  // Preserve setup order: authored WebMCP scripts expect the generated registry
  // to exist already. Only files without an overlay need an inserted bootstrap.
  if (generated.test(html)) return html.replace(generated, () => script);
  const authored = /<script\b[^>]*\bdata-vs-webmcp\b/i;
  if (authored.test(html)) return html.replace(authored, match => `${script}\n${match}`);
  return `${html}\n${script}`;
}

function showArtifact(data: SavedArtifact) {
  ++generation;
  selected = data;
  frameSession = crypto.randomUUID();
  catalog.hidden = filters.hidden = more.hidden = refresh.hidden = true;
  back.hidden = frame.hidden = false;
  element('#title').textContent = data.title || 'VS artifact';
  element('#subtitle').textContent = 'Feedback saved in VS · new comments reach subscribed chats';
  showStatus('');
  frame.srcdoc = reviewHtml(data.html, frameSession);
}

async function openArtifact(artifactId: string) {
  const request = ++generation;
  showStatus('Opening artifact…');
  try {
    const data = await call('vs.open-artifact', { artifactId }, savedArtifactSchema);
    if (request === generation) showArtifact(data);
  } catch (error) { if (request === generation) showStatus(error instanceof Error ? error.message : 'Artifact unavailable.'); }
}

app.ontoolresult = result => {
  const parsed = presentationSchema.safeParse(result.structuredContent);
  const data = parsed.success ? parsed.data : undefined;
  if (data?.kind === 'library') { ++generation; showLibrary(data); }
  else if (data?.kind === 'artifact') showArtifact(data);
  else if (!selected) showStatus('The artifact was not available.');
};

window.addEventListener('message', async event => {
  // Opaque-origin artifact scripts can request feedback only for the currently
  // displayed artifact; they cannot choose a tool, path, or subscription. A per-document
  // token also rejects old pagehide messages when the same iframe navigates.
  if (event.source !== frame.contentWindow || !selected || event.data?.session !== frameSession) return;
  const parsed = reviewMessageSchema.safeParse(event.data);
  if (!parsed.success) return;
  const snapshot = selected;
  const { requestId, action, comment } = parsed.data;
  let reply: ReviewReply;
  try {
    if (action === 'load') {
      const data = await call('vs.comments', { artifactId: snapshot.id }, commentsSchema);
      reply = { channel: 'vs-review-result', requestId, comments: data.comments, revision: snapshot.revision };
    } else {
      const data = await call('vs.save-comment', { artifactId: snapshot.id, revision: comment?.revision ?? snapshot.revision, comment }, savedCommentSchema);
      reply = { channel: 'vs-review-result', requestId, comment: data.comment };
    }
  } catch (error) { reply = { channel: 'vs-review-result', requestId, error: error instanceof Error ? error.message : 'Feedback unavailable.' }; }
  if (selected === snapshot) frame.contentWindow?.postMessage(reply, '*');
}, { signal });

filters.addEventListener('submit', event => { event.preventDefault(); clearTimeout(debounce); void loadLibrary(); }, { signal });
search.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => void loadLibrary(), 180); }, { signal });
project.addEventListener('change', () => { void loadLibrary(); }, { signal });
back.addEventListener('click', () => { selected = undefined; void loadLibrary(); }, { signal });
refresh.addEventListener('click', () => { void loadLibrary(); }, { signal });
more.addEventListener('click', () => { void loadLibrary(true); }, { signal });
window.addEventListener('pagehide', () => { controller.abort(); clearTimeout(debounce); }, { once: true });
void app.connect().catch(() => { showStatus('Unable to connect to the MCP App host. Reopen the VS library to retry.'); });
