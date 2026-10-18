import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

declare global {
  interface Window {
    fixture: { result: Record<string, unknown>; messaging: boolean };
    reviewHost: {
      messages: unknown[];
      reject: boolean;
      pending: boolean;
      release?: () => void;
      publish: (result: Record<string, unknown>) => Promise<void>;
    };
  }
}

const frame = document.querySelector<HTMLIFrameElement>('iframe')!;
const bridge = new AppBridge(null, { name: 'VS test host', version: '1.0.0' },
  window.fixture.messaging ? { message: { text: {} } } : {});
const state = window.reviewHost = {
  messages: [] as unknown[], reject: false, pending: false, release: undefined as (() => void) | undefined,
  async publish(result: Record<string, unknown>) {
    await bridge.sendToolInput({ arguments: { path: '/test/report.html' } });
    await bridge.sendToolResult({ content: [], structuredContent: result });
  },
};
bridge.onmessage = async (message) => {
  state.messages.push(message);
  if (state.pending) await new Promise<void>(resolve => { state.release = resolve; });
  return { isError: state.reject };
};
bridge.oninitialized = () => { void state.publish(window.fixture.result); };
// Establish the host listener before loading the guest; otherwise initialize can race.
void bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!)).then(() => {
  frame.src = '/view';
});
