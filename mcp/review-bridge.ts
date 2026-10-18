// Serialized into the artifact sandbox. Only the outer MCP App owns tool access;
// this bridge can load and save feedback for that one displayed artifact.
export function installReviewBridge(session: string) {
  const pending = new Map<string, { resolve: (value: ReviewReply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const unsaved = new Map<string, ReviewComment>();
  const controller = new AbortController();
  let saving = Promise.resolve();
  let revision: string;
  const request = (action: 'load' | 'save', comment?: ReviewComment): Promise<ReviewReply> => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('VS did not respond.')); }, 15_000);
    pending.set(requestId, { resolve, reject, timer });
    parent.postMessage({ channel: 'vs-review', session, requestId, action, comment }, '*');
  });
  window.addEventListener('message', (event: MessageEvent<ReviewReply>) => {
    if (event.source !== parent || event.data?.channel !== 'vs-review-result') return;
    const job = pending.get(event.data.requestId);
    if (!job) return;
    clearTimeout(job.timer);
    pending.delete(event.data.requestId);
    if ('error' in event.data) job.reject(new Error(event.data.error));
    else job.resolve(event.data);
  }, { signal: controller.signal });
  const bridge = {
    revision: '',
    onStatus: (_message: string) => {},
    async load() {
      const result = await request('load');
      if (!('comments' in result)) throw new Error('VS returned an invalid feedback response.');
      revision = bridge.revision = result.revision;
      return result.comments;
    },
    save(comment: ReviewComment) {
      const snapshot = { ...comment, revision: comment.revision ?? revision };
      unsaved.set(comment.id, snapshot);
      saving = saving.catch(() => {}).then(async () => {
        bridge.onStatus('Saving feedback in VS…');
        try {
          const result = await request('save', snapshot);
          if (!('comment' in result)) throw new Error('VS did not confirm the saved comment.');
          Object.assign(comment, result.comment);
          // A newer edit to this comment must not be cleared by an older acknowledgement.
          if (unsaved.get(comment.id) === snapshot) unsaved.delete(comment.id);
          bridge.onStatus(unsaved.size ? 'Some feedback is not saved. Use Retry.' : 'Saved in VS. Subscribed chats receive new comments.');
        } catch (error) {
          bridge.onStatus(`Feedback not saved: ${error instanceof Error ? error.message : 'VS unavailable.'} Use Retry.`);
        }
      });
    },
    retry() { for (const comment of unsaved.values()) bridge.save(comment); },
  };
  window.addEventListener('pagehide', () => {
    controller.abort();
    for (const job of pending.values()) { clearTimeout(job.timer); job.reject(new Error('Artifact closed.')); }
    pending.clear();
  }, { once: true });
  window.vsMcpReview = bridge;
  return bridge;
}
import type { ReviewComment, ReviewReply } from './contracts.ts';

declare global { interface Window { vsMcpReview?: ReturnType<typeof installReviewBridge> } }

