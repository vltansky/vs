import { App } from '@modelcontextprotocol/ext-apps';

const frame = document.querySelector<HTMLIFrameElement>('#vs-artifact-frame')!;
const status = document.querySelector<HTMLElement>('#status')!;
const app = new App({ name: 'VS artifact', version: '1.0.0' });

app.ontoolresult = (result) => {
  const html = (result.structuredContent as { html?: unknown } | undefined)?.html;
  if (typeof html !== 'string') {
    status.textContent = 'The artifact was not available.';
    return;
  }
  frame.srcdoc = html;
  frame.style.display = 'block';
  status.remove();
};

void app.connect().catch(() => { status.textContent = 'Unable to connect to the MCP App host.'; });
