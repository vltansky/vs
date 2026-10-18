import type { App } from '@modelcontextprotocol/ext-apps';
import { buildReviewRequest, reviewActions, type ReviewAction, type ReviewChoice, type ReviewPayload } from './findings.ts';

export function mountReview(root: HTMLElement, payload: ReviewPayload, app: App) {
  const controller = new AbortController();
  const { signal } = controller;
  const choices = new Map<string, ReviewChoice>();
  const notes = new Map<string, string>();
  let active = payload.findings[0].id;
  let busy = false;
  let confirmedRequest = '';
  const canMessage = !!app.getHostCapabilities()?.message?.text;

  root.innerHTML = `
    <fieldset class="review-workspace" data-editable>
      <legend class="sr-only">Select findings and add directions</legend>
      <section class="review-list" aria-label="Findings"><p class="section-label">Choose what happens next</p><div data-findings></div></section>
      <section class="review-evidence" aria-label="Finding evidence"><p class="section-label">Evidence and direction</p><h2 data-title></h2><p data-summary></p><div data-evidence></div>
        <label for="finding-note">Your correction or direction</label><textarea id="finding-note" maxlength="1500" placeholder="What should the agent change about this finding?"></textarea>
        <label for="review-constraints">Constraints for the whole request</label><textarea id="review-constraints" maxlength="4000"></textarea>
      </section>
    </fieldset>
    <section class="review-request" aria-label="Request preview"><div class="request-heading"><h2>Your request</h2><span data-count aria-live="polite"></span></div>
      <pre data-preview></pre>
      <div class="review-buttons"><button type="button" data-send class="primary">Review and send</button><button type="button" data-copy>Copy request</button></div>
      <div data-confirmation hidden><p>Send the exact request above to this chat? It requests a draft or investigation, not implementation.</p><div class="review-buttons"><button type="button" data-confirm class="primary">Confirm and send to chat</button><button type="button" data-cancel>Keep editing</button></div></div>
      <p data-send-status role="status"></p><p data-copy-status role="status"></p>
      <textarea data-manual-copy aria-label="Request to copy manually" readonly hidden></textarea>
    </section>`;

  const element = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const constraints = element<HTMLTextAreaElement>('#review-constraints');
  const note = element<HTMLTextAreaElement>('#finding-note');
  const preview = element<HTMLPreElement>('[data-preview]');
  const status = element<HTMLParagraphElement>('[data-send-status]');
  const copyStatus = element<HTMLParagraphElement>('[data-copy-status]');
  const send = element<HTMLButtonElement>('[data-send]');
  const copy = element<HTMLButtonElement>('[data-copy]');
  const confirm = element<HTMLButtonElement>('[data-confirm]');
  const cancel = element<HTMLButtonElement>('[data-cancel]');
  const confirmation = element<HTMLDivElement>('[data-confirmation]');
  const editable = element<HTMLFieldSetElement>('[data-editable]');
  const manualCopy = element<HTMLTextAreaElement>('[data-manual-copy]');
  const request = () => buildReviewRequest(payload, choices, constraints.value);
  const listen = (target: EventTarget, type: string, listener: EventListener) => target.addEventListener(type, listener, { signal });
  constraints.value = payload.constraints || 'Return a draft or investigation first. Do not implement changes.';

  function updateRequest() {
    const text = request();
    const tooLarge = text.length > 64_000;
    preview.textContent = text || 'Select an action for a finding to prepare your request.';
    element('[data-count]').textContent = `${choices.size} of ${payload.findings.length} selected`;
    send.disabled = !text || busy || !canMessage || tooLarge;
    copy.disabled = !text || busy;
    confirmedRequest = '';
    confirmation.hidden = true;
    manualCopy.hidden = true;
    copyStatus.textContent = '';
    status.textContent = tooLarge ? 'This request exceeds 64,000 characters. Select fewer findings before sending.'
      : !canMessage ? 'This host does not support chat messages. Copy the request and paste it into the conversation.'
        : 'This preview has not been sent. Review it before sending.';
  }

  function showEvidence(id: string) {
    active = id;
    const finding = payload.findings.find(item => item.id === id)!;
    element('[data-title]').textContent = finding.title;
    element('[data-summary]').textContent = finding.summary;
    const evidence = element('[data-evidence]');
    evidence.replaceChildren();
    for (const source of finding.evidence) {
      if (source.quote) {
        const quote = document.createElement('blockquote'); quote.textContent = source.quote; evidence.append(quote);
      }
      const label = document.createElement('p'); label.className = 'evidence-source'; label.textContent = source.source; evidence.append(label);
    }
    note.value = notes.get(id) || '';
    note.disabled = !choices.has(id);
    note.placeholder = note.disabled ? 'Choose an action for this finding to add a direction.' : 'What should the agent change about this finding?';
    for (const row of root.querySelectorAll<HTMLElement>('[data-finding]')) {
      const selected = row.dataset.finding === id;
      row.dataset.active = String(selected);
      row.querySelector('button')!.setAttribute('aria-pressed', String(selected));
    }
  }

  for (const finding of payload.findings) {
    const row = document.createElement('div'); row.className = 'review-finding'; row.dataset.finding = finding.id;
    const title = document.createElement('button'); title.type = 'button'; title.className = 'finding-title'; title.textContent = finding.title;
    listen(title, 'click', () => showEvidence(finding.id));
    const summary = document.createElement('p'); summary.textContent = finding.summary;
    const select = document.createElement('select'); select.setAttribute('aria-label', `Action for ${finding.title}`);
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose an action'; select.append(placeholder);
    for (const [value, label] of reviewActions) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    }
    listen(select, 'change', () => {
      if (select.value) choices.set(finding.id, { action: select.value as ReviewAction, note: notes.get(finding.id) || '' });
      else choices.delete(finding.id);
      showEvidence(finding.id); updateRequest();
    });
    row.append(title, summary, select); element('[data-findings]').append(row);
  }

  listen(note, 'input', () => {
    notes.set(active, note.value);
    const choice = choices.get(active);
    if (choice) choices.set(active, { ...choice, note: note.value });
    updateRequest();
  });
  listen(constraints, 'input', updateRequest);
  listen(send, 'click', () => {
    if (send.disabled || busy) return;
    confirmedRequest = request(); confirmation.hidden = false; confirm.focus();
  });
  listen(cancel, 'click', () => { confirmation.hidden = true; confirmedRequest = ''; send.focus(); });
  listen(confirm, 'click', async () => {
    if (busy || !canMessage || !confirmedRequest || confirmedRequest !== request()) return;
    // Freeze the reviewed snapshot during transport; edits must require fresh confirmation.
    const text = confirmedRequest;
    busy = true; editable.disabled = true; send.disabled = true; copy.disabled = true; confirm.disabled = true; cancel.disabled = true;
    status.textContent = 'Sending request to the host…';
    try {
      const result = await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] }, { signal, timeout: 30_000 });
      if (signal.aborted) return;
      status.textContent = result.isError
        ? 'The host rejected the request. Nothing was confirmed as sent; copy it or review and try again.'
        : 'The host accepted the request. Check the conversation for the agent’s response.';
    } catch {
      if (signal.aborted) return;
      status.textContent = 'Delivery is unconfirmed. Check the conversation before retrying to avoid a duplicate request.';
    } finally {
      if (!signal.aborted) {
        busy = false; editable.disabled = false; send.disabled = !canMessage; copy.disabled = false; confirm.disabled = false; cancel.disabled = false;
        confirmation.hidden = true; confirmedRequest = '';
      }
    }
  });
  listen(copy, 'click', async () => {
    const text = request(); if (!text || busy) return;
    try {
      await navigator.clipboard.writeText(text);
      if (!signal.aborted) copyStatus.textContent = 'Copied. Paste the request into the conversation.';
    } catch {
      if (signal.aborted) return;
      manualCopy.value = text; manualCopy.hidden = false; manualCopy.focus(); manualCopy.select();
      copyStatus.textContent = 'Copy the selected text below and paste it into the conversation.';
    }
  });

  showEvidence(active); updateRequest();
  // A new tool result owns new choices; dispose the previous view before mounting it.
  return () => controller.abort();
}
