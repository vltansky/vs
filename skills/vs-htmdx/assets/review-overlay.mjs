// Portable artifact review: human text/element comments, resilient anchors,
// visible markers, and browser-local persistence. The generated artifact
// inlines this file and has no external runtime dependency.

export const reviewOverlayCss = `
:host { color: #ABB2BF; }
* { box-sizing: border-box; }
button, textarea { font: inherit; }
.vs-review-surface { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: 'Figtree', sans-serif; }
.vs-review-interactive { pointer-events: auto; }
.vs-review-fab {
  position: fixed; right: 18px; bottom: 18px; min-width: 44px; height: 40px;
  border: 1px solid #4B5263; border-radius: 6px;
  padding: 0 14px; background: #21252C; color: #D7DAE0; cursor: pointer;
  display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 600;
  box-shadow: 0 8px 24px rgb(0 0 0 / 36%);
  transition: transform 140ms ease, border-color 140ms ease, color 140ms ease;
}
.vs-review-fab:hover { border-color: #93A4E8; color: #93A4E8; transform: translate(-1px, -1px); }
.vs-review-fab [data-count]:not(:empty) { color: #21252C; background: #93A4E8; padding: 1px 5px; border-radius: 999px; }
.vs-review-panel {
  position: fixed; top: 14px; right: 14px; bottom: 14px; width: min(380px, calc(100vw - 28px));
  border: 1px solid #4B5263; border-radius: 8px;
  background: #21252C; color: #D7DAE0; box-shadow: 0 16px 48px rgb(0 0 0 / 42%);
  overflow: hidden; display: flex; flex-direction: column;
  transform: translateX(calc(100% + 32px)); opacity: 0;
  transition: transform 180ms ease, opacity 180ms ease;
}
.vs-review-panel[data-open='true'] { transform: translateX(0); opacity: 1; }
.vs-review-header { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; border-bottom: 1px solid #3E4451; }
.vs-review-header strong { font-size: 15px; font-weight: 600; }
.vs-review-header-actions { display: flex; gap: 6px; }
.vs-review-icon-button, .vs-review-text-button {
  border: 1px solid transparent; background: transparent; color: #ABB2BF; cursor: pointer;
  border-radius: 5px;
}
.vs-review-icon-button { width: 32px; height: 32px; font-size: 17px; }
.vs-review-icon-button:hover, .vs-review-icon-button[data-active='true'] { border-color: #5C6370; color: #93A4E8; background: #282C34; }
.vs-review-note { padding: 9px 14px; color: #7F848E; font-size: 12px; border-bottom: 1px solid #3E4451; }
.vs-review-list { list-style: none; margin: 0; padding: 0 14px; overflow: auto; }
.vs-review-thread { border: 0; border-bottom: 1px solid #3E4451; background: transparent; padding: 14px 4px 14px 10px; cursor: pointer; }
.vs-review-thread:hover, .vs-review-thread[data-focused='true'] { background: #282C34; box-shadow: inset 2px 0 0 #93A4E8; }
.vs-review-thread[data-resolved='true'] { opacity: .58; }
.vs-review-thread-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #7F848E; font: 10px/1.4 'JetBrains Mono', ui-monospace, monospace; text-transform: uppercase; }
.vs-review-thread p { margin: 8px 0 0; color: #D7DAE0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
.vs-review-empty { color: #7F848E; text-align: left; padding: 36px 6px; font-size: 13px; line-height: 1.55; }
.vs-review-marker {
  position: fixed; width: 24px; height: 24px; border: 2px solid #282C34; border-radius: 50%;
  background: #93A4E8; color: #21252C; box-shadow: 3px 3px 0 rgb(0 0 0 / 24%);
  font-size: 10px; font-weight: 800; cursor: pointer; transform: translate(-50%, -50%);
}
.vs-review-marker[data-resolved='true'] { background: #858da1; }
.vs-review-highlight { position: fixed; border: 1px dashed #93A4E8; border-radius: 6px 2px 5px 3px; background: rgb(147 164 232 / 12%); pointer-events: none; }
.vs-review-removal { position: fixed; height: 2px; background: #E06C75; box-shadow: 0 0 0 1px rgb(33 37 44 / 72%); pointer-events: none; }
.vs-review-question { position: fixed; width: 18px; height: 18px; border: 1px solid #21252C; border-radius: 50%; background: #E5C07B; color: #21252C; display: grid; place-items: center; box-shadow: 2px 2px 0 rgb(0 0 0 / 22%); font: 700 11px/1 'Figtree', sans-serif; pointer-events: none; transform: translateY(-50%); }
.vs-review-selection-action {
  position: fixed; display: flex; overflow: hidden; border: 1px solid #4B5263; border-radius: 6px;
  background: #21252C; box-shadow: 0 8px 24px rgb(0 0 0 / 36%);
}
.vs-review-selection-action[hidden] { display: none; }
.vs-review-selection-action button { min-height: 30px; border: 0; border-right: 1px solid #3E4451; padding: 0 10px; background: transparent; color: #D7DAE0; cursor: pointer; font-size: 11px; font-weight: 600; }
.vs-review-selection-action button:last-child { border-right: 0; }
.vs-review-selection-action button:hover { background: #282C34; color: #93A4E8; }
.vs-review-composer {
  position: fixed; width: min(320px, calc(100vw - 24px)); padding: 10px; border: 1px solid #4B5263;
  border-radius: 8px; background: #21252C;
  box-shadow: 0 12px 36px rgb(0 0 0 / 42%);
}
.vs-review-composer textarea { width: 100%; min-height: 88px; resize: vertical; border: 1px solid #3E4451; outline: 0; padding: 10px; color: #D7DAE0; background: #282C34; font-size: 12px; }
.vs-review-composer textarea:focus { border-color: #93A4E8; }
.vs-review-composer-actions { display: flex; justify-content: flex-end; gap: 7px; padding-top: 8px; }
.vs-review-text-button { padding: 7px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.vs-review-text-button:hover { border-color: #5C6370; color: #D7DAE0; }
.vs-review-text-button[data-primary='true'] { border-color: #93A4E8; background: #93A4E8; color: #21252C; }
.vs-review-text-button:disabled { opacity: .45; cursor: default; }
.vs-review-surface :focus-visible { outline: 2px solid #93A4E8; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .vs-review-panel, .vs-review-fab { transition: none; } }
`;

export function resolveQuoteStart(text, quote) {
  const starts = [];
  for (let start = text.indexOf(quote.exact); start >= 0; start = text.indexOf(quote.exact, start + 1)) starts.push(start);
  if (starts.length === 0) return null;
  if (starts.length === 1) return starts[0];
  const prefixScore = (value, expected) => {
    const length = Math.min(value.length, expected.length);
    let matched = 0;
    while (matched < length && value[value.length - matched - 1] === expected[expected.length - matched - 1]) matched++;
    return matched;
  };
  const suffixScore = (value, expected) => {
    const length = Math.min(value.length, expected.length);
    let matched = 0;
    while (matched < length && value[matched] === expected[matched]) matched++;
    return matched;
  };
  const scored = starts.map((candidate) => ({
    candidate,
    score: prefixScore(text.slice(0, candidate), quote.prefix) + suffixScore(text.slice(candidate + quote.exact.length), quote.suffix),
  }));
  const bestScore = Math.max(...scored.map(({ score }) => score));
  const best = scored.filter(({ score }) => score === bestScore);
  const minimumScore = Math.min(8, Math.max(quote.prefix.length, quote.suffix.length));
  const secondScore = Math.max(...scored.filter(({ score }) => score < bestScore).map(({ score }) => score), 0);
  const minimumGap = Math.min(4, minimumScore);
  return best.length === 1 && bestScore >= minimumScore && bestScore - secondScore >= minimumGap ? best[0].candidate : null;
}

export function reviewStorageKey(artifactId, href) {
  const stableId = artifactId.trim();
  return stableId === '' ? `vs-review:${href.split('#')[0]}` : `vs-review:artifact:${stableId}`;
}

export function reviewToolFactory(api) {
  return [
    {
      name: 'list_review_comments',
      description: 'List review comments saved in this browser for the current artifact, including IDs, intent, status, and anchor summaries.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, idempotentHint: true },
      execute: () => ({ comments: api.list() }),
    },
    {
      name: 'add_review_comment',
      description: 'Add a visible review comment to an element, or to unique text inside it. Use a CSS selector for an existing artifact element. Add exactText and optional surrounding context for a text anchor.',
      inputSchema: {
        type: 'object',
        properties: {
          comment: { type: 'string', minLength: 1, maxLength: 5000, description: 'Review feedback to save.' },
          selector: { type: 'string', minLength: 1, description: 'CSS selector for the target artifact element.' },
          exactText: { type: 'string', minLength: 1, description: 'Optional exact text to anchor inside the target.' },
          prefix: { type: 'string', description: 'Optional text immediately before exactText, used to disambiguate repeats.' },
          suffix: { type: 'string', description: 'Optional text immediately after exactText, used to disambiguate repeats.' },
        },
        required: ['comment', 'selector'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, idempotentHint: false },
      execute: (input) => api.add(input),
    },
    {
      name: 'resolve_review_comment',
      description: 'Resolve or reopen one review comment by ID. The comment remains visible in the review panel.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, description: 'Comment ID returned by list_review_comments.' },
          resolved: { type: 'boolean', description: 'True to resolve; false to reopen.' },
        },
        required: ['id', 'resolved'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
      execute: (input) => api.resolve(input),
    },
  ];
}

export function artifactToolRegistryFactory(modelContext, parentSignal) {
  return Object.freeze({
    registerTool(tool) {
      if (modelContext === undefined) {
        return Object.freeze({ available: false, ready: Promise.resolve(), unregister() {} });
      }
      const controller = new AbortController();
      // Authored tools belong to this artifact lifetime. Aborting them with
      // the shell prevents stale tools from surviving a rerender or teardown.
      parentSignal?.addEventListener('abort', () => controller.abort(), { once: true });
      let ready;
      try { ready = Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })); }
      catch (error) { ready = Promise.reject(error); }
      return Object.freeze({ available: true, ready, unregister: () => controller.abort() });
    },
  });
}

export function reviewOverlayFactory(css, resolveQuoteStartFn, reviewToolFactoryFn, artifactToolRegistryFactoryFn, reviewStorageKeyFn) {
  if (document.documentElement.hasAttribute('data-vs-review-installed')) return;
  document.documentElement.setAttribute('data-vs-review-installed', 'true');

  const controller = new AbortController();
  const { signal } = controller;
  const artifactId = document.querySelector('meta[name="vs-artifact-id"]')?.content ?? '';
  const storageKey = reviewStorageKeyFn(artifactId, location.href);
  const state = {
    comments: loadComments(), panelOpen: false, commenting: false,
    draft: null, selection: null, focusedId: null, refreshFrame: null,
  };
  const artifactTools = artifactToolRegistryFactoryFn(document.modelContext, signal);
  window.vsArtifact = artifactTools;
  const quickFeedback = new Map([
    ['remove', 'Remove this.'],
    ['simplify', "I don't understand this. Rewrite it for someone new to the topic. Lead with the main point. Use familiar words and short sentences. Explain necessary terms. Make any action or recommendation concrete. Keep the original meaning, facts, and important details."],
  ]);

  const host = document.createElement('div');
  host.setAttribute('popover', 'manual');
  host.style.cssText = 'all:initial;position:fixed;inset:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647;color-scheme:light';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const surface = document.createElement('div');
  surface.className = 'vs-review-surface';
  surface.innerHTML = `
    <div class="vs-review-highlight-layer"></div>
    <div class="vs-review-removal-layer"></div>
    <div class="vs-review-question-layer"></div>
    <div class="vs-review-marker-layer"></div>
    <button class="vs-review-fab vs-review-interactive" type="button" aria-label="Open comments">Comments <span data-count></span></button>
    <aside class="vs-review-panel vs-review-interactive" aria-label="Comments panel" aria-live="polite">
      <div class="vs-review-header"><strong>Comments</strong><div class="vs-review-header-actions">
        <button class="vs-review-icon-button" data-add type="button" aria-label="Add comment" title="Add comment">＋</button>
        <button class="vs-review-icon-button" data-close type="button" aria-label="Close comments">×</button>
      </div></div>
      <div class="vs-review-note">Saved in this browser for this artifact.</div>
      <ol class="vs-review-list"></ol>
    </aside>
    <div class="vs-review-selection-action vs-review-interactive" role="toolbar" aria-label="Selected text feedback" hidden>
      <button data-comment type="button">Comment</button>
      <button data-intent="remove" type="button" aria-label="Remove selected text">Remove</button>
      <button data-intent="simplify" type="button" aria-label="Rewrite selected text more simply">What?</button>
    </div>
    <form class="vs-review-composer vs-review-interactive" aria-label="Add review comment" hidden>
      <textarea maxlength="5000" placeholder="Add a comment" required></textarea>
      <div class="vs-review-composer-actions">
        <button class="vs-review-text-button" data-cancel type="button">Cancel</button>
        <button class="vs-review-text-button" data-primary="true" type="submit" disabled>Add</button>
      </div>
    </form>`;
  shadow.append(style, surface);

  const panel = surface.querySelector('.vs-review-panel');
  const list = surface.querySelector('.vs-review-list');
  const count = surface.querySelector('[data-count]');
  const addButton = surface.querySelector('[data-add]');
  const action = surface.querySelector('.vs-review-selection-action');
  const composer = surface.querySelector('.vs-review-composer');
  const textarea = composer.querySelector('textarea');
  const submitButton = composer.querySelector('[type="submit"]');
  const markerLayer = surface.querySelector('.vs-review-marker-layer');
  const highlightLayer = surface.querySelector('.vs-review-highlight-layer');
  const removalLayer = surface.querySelector('.vs-review-removal-layer');
  const questionLayer = surface.querySelector('.vs-review-question-layer');

  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal });
  listen(surface.querySelector('.vs-review-fab'), 'click', () => setPanel(true));
  listen(surface.querySelector('[data-close]'), 'click', () => setPanel(false));
  listen(addButton, 'click', () => setCommenting(!state.commenting));
  listen(surface.querySelector('[data-cancel]'), 'click', closeComposer);
  listen(textarea, 'input', () => { submitButton.disabled = textarea.value.trim() === ''; });
  listen(action, 'pointerdown', (event) => event.preventDefault());
  listen(action.querySelector('[data-comment]'), 'click', () => {
    if (state.selection !== null) openComposer(state.selection.anchor, state.selection.x, state.selection.y);
    hideSelectionAction();
  });
  action.querySelectorAll('[data-intent]').forEach((button) => listen(button, 'click', () => addSelectionFeedback(button.dataset.intent)));
  listen(composer, 'submit', (event) => {
    event.preventDefault();
    const comment = textarea.value.trim();
    if (comment === '' || state.draft === null) return;
    const created = appendComment(state.draft.anchor, comment);
    state.focusedId = created.id;
    closeComposer();
    setPanel(true);
    render();
  });
  listen(composer, 'keydown', (event) => {
    if (event.key === 'Escape') closeComposer();
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') composer.requestSubmit();
  });
  listen(document, 'mouseup', () => requestAnimationFrame(captureSelection), { capture: true });
  listen(document, 'pointerover', previewCommentTarget, { capture: true });
  listen(document, 'click', captureCommentTarget, { capture: true });
  listen(document, 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!composer.hidden) closeComposer();
    else if (state.commenting) setCommenting(false);
  }, { capture: true });
  listen(window, 'scroll', scheduleRefresh, { capture: true, passive: true });
  listen(window, 'resize', scheduleRefresh, { passive: true });
  listen(document, 'htmdx:rendered', scheduleRefresh);

  const reviewApi = { list: listReviewComments, add: addReviewComment, resolve: resolveReviewComment };
  for (const tool of reviewToolFactoryFn(reviewApi)) {
    void artifactTools.registerTool(tool).ready.catch(() => {});
  }

  const observer = new MutationObserver(() => {
    if (!host.isConnected && document.body !== null) document.body.append(host);
    scheduleRefresh();
  });
  observer.observe(document, { childList: true, subtree: true });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });

  mount();
  render();

  function mount() {
    if (document.body === null || host.isConnected) return;
    document.body.append(host);
    try { host.showPopover(); } catch { host.style.pointerEvents = 'none'; }
  }

  function setPanel(open) {
    state.panelOpen = open;
    panel.dataset.open = String(open);
  }

  function setCommenting(active) {
    state.commenting = active;
    addButton.dataset.active = String(active);
    document.documentElement.style.cursor = active ? 'crosshair' : '';
    if (!active) clearHighlights();
    if (active) setPanel(true);
  }

  function captureSelection() {
    if (state.commenting || !composer.hidden) return;
    const selection = window.getSelection();
    if (selection === null || selection.isCollapsed || selection.rangeCount !== 1) return hideSelectionAction();
    const range = selection.getRangeAt(0).cloneRange();
    const root = toElement(range.commonAncestorContainer);
    if (root === null || host.contains(root) || range.toString().trim() === '') return hideSelectionAction();
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    const rect = rects.at(-1);
    if (rect === undefined) return hideSelectionAction();
    const anchor = createTextAnchor(range, root);
    state.selection = { anchor, x: Math.min(rect.right + 8, innerWidth - 220), y: Math.min(rect.bottom + 8, innerHeight - 40) };
    action.style.left = `${state.selection.x}px`;
    action.style.top = `${state.selection.y}px`;
    action.hidden = false;
  }

  function hideSelectionAction() {
    state.selection = null;
    action.hidden = true;
  }

  function addSelectionFeedback(intent) {
    const comment = quickFeedback.get(intent);
    if (state.selection === null || comment === undefined) return;
    const created = appendComment(state.selection.anchor, comment, intent);
    state.focusedId = created.id;
    hideSelectionAction();
    setPanel(true);
    render();
  }

  function previewCommentTarget(event) {
    if (!state.commenting || isReviewEvent(event)) return;
    const element = reviewTarget(event.target);
    if (element === null) return clearHighlights();
    renderHighlights(createElementAnchor(element, event.clientX, event.clientY));
  }

  function captureCommentTarget(event) {
    if (!state.commenting || isReviewEvent(event)) return;
    const element = reviewTarget(event.target);
    if (element === null) return;
    event.preventDefault();
    event.stopPropagation();
    openComposer(createElementAnchor(element, event.clientX, event.clientY), event.clientX + 10, event.clientY + 10);
    setCommenting(false);
  }

  function reviewTarget(value) {
    const element = value instanceof Element ? value : value?.parentElement;
    return element?.closest('[data-htmdx-component], .htmdx-mermaid, figure, table, blockquote, pre, p, li, h1, h2, h3, h4, h5, h6') ?? element;
  }

  function isReviewEvent(event) {
    const path = event.composedPath?.() ?? [];
    return path.includes(host) || path.includes(shadow) || path.includes(surface);
  }

  function openComposer(anchor, x, y) {
    state.draft = { anchor };
    composer.style.left = `${Math.min(Math.max(12, x), innerWidth - 312)}px`;
    composer.style.top = `${Math.min(Math.max(12, y), innerHeight - 150)}px`;
    composer.hidden = false;
    textarea.value = '';
    submitButton.disabled = true;
    textarea.focus();
    renderHighlights(anchor);
  }

  function closeComposer() {
    state.draft = null;
    composer.hidden = true;
    textarea.value = '';
    submitButton.disabled = true;
    clearHighlights();
  }

  function appendComment(anchor, comment, intent = 'comment') {
    const created = {
      id: globalThis.crypto?.randomUUID?.() ?? `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      anchor, comment, intent, createdAt: new Date().toISOString(), status: 'open',
    };
    state.comments.push(created);
    if (state.comments.length > 100) state.comments.splice(0, state.comments.length - 100);
    saveReviewState();
    return created;
  }

  function listReviewComments() { return state.comments.map(publicComment); }

  function addReviewComment(input) {
    const comment = typeof input?.comment === 'string' ? input.comment.trim() : '';
    if (comment === '' || comment.length > 5000) throw new Error('comment must contain 1 to 5000 characters');
    if (typeof input?.selector !== 'string' || input.selector.trim() === '') throw new Error('selector is required');
    let root;
    try { root = document.querySelector(input.selector); } catch { throw new Error(`Invalid CSS selector: ${input.selector}`); }
    if (root === null || root === host || host.contains(root)) throw new Error(`No artifact element matches selector: ${input.selector}`);

    let anchor;
    if (input.exactText === undefined) {
      const rect = root.getBoundingClientRect();
      anchor = createElementAnchor(root, rect.right, rect.top);
    } else {
      if (typeof input.exactText !== 'string' || input.exactText === '') throw new Error('exactText must not be empty');
      const quote = {
        exact: input.exactText,
        prefix: typeof input.prefix === 'string' ? input.prefix : '',
        suffix: typeof input.suffix === 'string' ? input.suffix : '',
      };
      const start = resolveQuoteStartFn(root.textContent ?? '', quote);
      if (start === null) throw new Error('exactText was missing or ambiguous inside selector; narrow the selector or add prefix/suffix');
      const range = rangeFromOffsets(root, start, start + quote.exact.length);
      if (range === null) throw new Error('Could not create a text range for exactText');
      anchor = createTextAnchor(range, root);
    }

    const created = appendComment(anchor, comment);
    state.focusedId = created.id;
    setPanel(true);
    render();
    renderHighlights(anchor);
    return publicComment(created);
  }

  function resolveReviewComment(input) {
    if (typeof input?.id !== 'string' || typeof input?.resolved !== 'boolean') throw new Error('id and resolved are required');
    const comment = state.comments.find(({ id }) => id === input.id);
    if (comment === undefined) throw new Error(`Unknown review comment: ${input.id}`);
    comment.status = input.resolved ? 'resolved' : 'open';
    saveReviewState();
    render();
    return publicComment(comment);
  }

  function publicComment(comment) {
    return {
      id: comment.id,
      comment: comment.comment,
      intent: comment.intent ?? 'comment',
      status: comment.status,
      createdAt: comment.createdAt,
      anchor: {
        selector: comment.anchor.selector,
        textHint: comment.anchor.textHint,
        exactText: comment.anchor.textRange?.quote.exact,
      },
    };
  }

  function render() {
    const openCount = state.comments.filter(({ status }) => status !== 'resolved').length;
    count.textContent = openCount === 0 ? '' : String(openCount);
    list.replaceChildren();
    if (state.comments.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'vs-review-empty';
      empty.textContent = 'Select text, or choose + and click an element, to leave a comment.';
      list.append(empty);
    }
    state.comments.forEach((comment, index) => list.append(renderThread(comment, index)));
    renderMarkers();
    renderRemovals();
    renderQuestions();
  }

  function renderThread(comment, index) {
    const item = document.createElement('li');
    item.className = 'vs-review-thread';
    item.dataset.commentId = comment.id;
    item.dataset.resolved = String(comment.status === 'resolved');
    item.dataset.focused = String(comment.id === state.focusedId);
    const head = document.createElement('div');
    head.className = 'vs-review-thread-head';
    const meta = document.createElement('span');
    const intent = comment.intent === 'remove' ? 'Remove' : comment.intent === 'simplify' ? 'Simplify' : 'Comment';
    meta.textContent = `${index + 1} · ${intent} · You · ${new Date(comment.createdAt).toLocaleString()}`;
    const toggle = document.createElement('button');
    toggle.className = 'vs-review-icon-button';
    toggle.type = 'button';
    toggle.title = comment.status === 'resolved' ? 'Re-open' : 'Resolve';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.textContent = comment.status === 'resolved' ? '↶' : '✓';
    listen(toggle, 'click', (event) => {
      event.stopPropagation();
      comment.status = comment.status === 'resolved' ? 'open' : 'resolved';
      saveReviewState();
      render();
    });
    const body = document.createElement('p');
    body.textContent = comment.comment;
    head.append(meta, toggle);
    item.append(head, body);
    listen(item, 'click', () => focusComment(comment));
    listen(item, 'mouseenter', () => renderHighlights(comment.anchor));
    listen(item, 'mouseleave', () => comment.id === state.focusedId ? renderHighlights(comment.anchor) : clearHighlights());
    return item;
  }

  function focusComment(comment) {
    state.focusedId = comment.id;
    setPanel(true);
    const element = resolveAnchorElement(comment.anchor);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    render();
    renderHighlights(comment.anchor);
    list.querySelector(`[data-comment-id="${CSS.escape(comment.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function renderMarkers() {
    markerLayer.replaceChildren();
    state.comments.forEach((comment, index) => {
      const rects = anchorRects(comment.anchor);
      const rect = rects.at(-1);
      if (rect === undefined) return;
      const marker = document.createElement('button');
      marker.className = 'vs-review-marker vs-review-interactive';
      marker.type = 'button';
      marker.textContent = String(index + 1);
      marker.dataset.resolved = String(comment.status === 'resolved');
      marker.setAttribute('aria-label', `Open comment ${index + 1}`);
      const point = comment.anchor.elementPosition;
      marker.style.left = `${point === undefined ? rect.right : rect.left + rect.width * point.x / 100}px`;
      marker.style.top = `${point === undefined ? rect.top : rect.top + rect.height * point.y / 100}px`;
      listen(marker, 'click', () => focusComment(comment));
      listen(marker, 'mouseenter', () => renderHighlights(comment.anchor));
      listen(marker, 'mouseleave', () => comment.id === state.focusedId ? renderHighlights(comment.anchor) : clearHighlights());
      markerLayer.append(marker);
    });
  }

  function renderRemovals() {
    removalLayer.replaceChildren();
    state.comments.filter(({ intent, status }) => intent === 'remove' && status === 'open').forEach(({ anchor }) => {
      anchorRects(anchor).forEach((rect) => {
        const strike = document.createElement('span');
        strike.className = 'vs-review-removal';
        strike.style.left = `${rect.left}px`;
        strike.style.top = `${rect.top + rect.height * .52}px`;
        strike.style.width = `${rect.width}px`;
        removalLayer.append(strike);
      });
    });
  }

  function renderQuestions() {
    questionLayer.replaceChildren();
    state.comments.filter(({ intent, status }) => intent === 'simplify' && status === 'open').forEach(({ anchor }) => {
      const rect = anchorRects(anchor).at(-1);
      if (rect === undefined) return;
      const question = document.createElement('span');
      question.className = 'vs-review-question';
      question.textContent = '?';
      question.style.left = `${rect.right + 32 <= innerWidth ? rect.right + 14 : rect.right - 32}px`;
      question.style.top = `${rect.top}px`;
      questionLayer.append(question);
    });
  }

  function renderHighlights(anchor) {
    clearHighlights();
    anchorRects(anchor).forEach((rect) => {
      const highlight = document.createElement('span');
      highlight.className = 'vs-review-highlight';
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlightLayer.append(highlight);
    });
  }

  function clearHighlights() { highlightLayer.replaceChildren(); }

  function scheduleRefresh() {
    if (state.refreshFrame !== null) return;
    state.refreshFrame = requestAnimationFrame(() => {
      state.refreshFrame = null;
      renderMarkers();
      renderRemovals();
      renderQuestions();
      const focused = state.comments.find(({ id }) => id === state.focusedId);
      if (focused !== undefined) renderHighlights(focused.anchor);
    });
  }

  function createTextAnchor(range, root) {
    const exact = range.toString();
    const start = textOffsetAtBoundary(root, range.startContainer, range.startOffset);
    const text = root.textContent ?? '';
    return {
      kind: 'html', selector: cssPath(root), textHint: exact.slice(0, 80),
      textRange: {
        range: { startPath: nodePath(root, range.startContainer), startOffset: range.startOffset, endPath: nodePath(root, range.endContainer), endOffset: range.endOffset },
        position: { start, end: start + exact.length },
        quote: { exact, prefix: text.slice(Math.max(0, start - 64), start), suffix: text.slice(start + exact.length, start + exact.length + 64) },
      },
    };
  }

  function createElementAnchor(element, clientX, clientY) {
    const rect = element.getBoundingClientRect();
    return {
      kind: 'html', selector: cssPath(element), textHint: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80) || element.tagName.toLowerCase(),
      elementPosition: { x: clamp(((clientX - rect.left) / Math.max(rect.width, 1)) * 100), y: clamp(((clientY - rect.top) / Math.max(rect.height, 1)) * 100) },
    };
  }

  function resolveAnchorElement(anchor) {
    try { return document.querySelector(anchor.selector); } catch { return null; }
  }

  function anchorRects(anchor) {
    const root = resolveAnchorElement(anchor);
    if (root === null) return [];
    if (anchor.textRange !== undefined) {
      const range = resolveTextRange(anchor.textRange, root);
      return range === null ? [] : [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    }
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    return [rect];
  }

  function resolveTextRange(selector, root) {
    const structural = structuralRange(selector, root);
    if (structural?.toString() === selector.quote.exact) return structural;
    const positional = rangeFromOffsets(root, selector.position.start, selector.position.end);
    if (positional?.toString() === selector.quote.exact) return positional;
    const start = resolveQuoteStartFn(root.textContent ?? '', selector.quote);
    return start === null ? null : rangeFromOffsets(root, start, start + selector.quote.exact.length);
  }

  function structuralRange(selector, root) {
    const start = nodeAtPath(root, selector.range.startPath);
    const end = nodeAtPath(root, selector.range.endPath);
    if (start === null || end === null) return null;
    try {
      const range = document.createRange();
      range.setStart(start, selector.range.startOffset);
      range.setEnd(end, selector.range.endOffset);
      return range;
    } catch { return null; }
  }

  function rangeFromOffsets(root, start, end) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) nodes.push(node);
    const boundary = (target) => {
      let offset = 0;
      for (const node of nodes) {
        if (target <= offset + node.data.length) return { node, offset: target - offset };
        offset += node.data.length;
      }
      return null;
    };
    const from = boundary(start);
    const to = boundary(end);
    if (from === null || to === null) return null;
    const range = document.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    return range;
  }

  function textOffsetAtBoundary(root, container, offset) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(container, offset);
    return range.toString().length;
  }

  function nodePath(root, node) {
    const path = [];
    for (let current = node; current !== root; current = current.parentNode) {
      if (current?.parentNode === null) throw new Error('Text range must be inside its root element');
      path.unshift([...current.parentNode.childNodes].indexOf(current));
    }
    return path;
  }

  function nodeAtPath(root, path) {
    let current = root;
    for (const index of path) {
      current = current.childNodes.item(index);
      if (current === null) return null;
    }
    return current;
  }

  function cssPath(element) {
    const path = [];
    for (let current = element; current !== null && current !== document.body; current = current.parentElement) {
      let segment = current.nodeName.toLowerCase();
      if (current.id !== '') {
        path.unshift(`${segment}#${CSS.escape(current.id)}`);
        return path.join(' > ');
      }
      const siblings = current.parentElement === null ? [] : [...current.parentElement.children].filter((child) => child.nodeName === current.nodeName);
      if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      path.unshift(segment);
    }
    return path.length === 0 ? 'body' : `body > ${path.join(' > ')}`;
  }

  function toElement(node) { return node.nodeType === 1 ? node : node.parentElement; }
  function clamp(value) { return Math.min(Math.max(value, 0), 100); }

  function loadComments() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '{"comments":[]}');
      return Array.isArray(parsed.comments) ? parsed.comments.filter(validComment).slice(-100) : [];
    } catch { return []; }
  }

  function saveReviewState() {
    try { localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 2, comments: state.comments })); } catch { /* Session state remains visible. */ }
  }

  function validComment(value) {
    return value !== null && typeof value === 'object' && typeof value.id === 'string' && typeof value.comment === 'string' && value.comment.length <= 5000 && (value.intent === undefined || ['comment', 'remove', 'simplify'].includes(value.intent)) && value.anchor?.kind === 'html' && typeof value.anchor.selector === 'string';
  }
}
