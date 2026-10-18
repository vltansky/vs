import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from './pathgrade-agent';
import { promptOnce } from './pathgrade-v1';

const SKILLS = path.resolve(__dirname, '../..');
// A minimal host fixture tests routing without depending on an installed Codex plugin.
const HOST_SKILL = `---
name: visualize
description: Render interactive previews inside a conversation.
---
Write an HTML fragment, not a full document, to an absolute path under the
workspace's previews directory. Inline CSS and JavaScript are supported.
Use local interactions only. Return this content reference in the final reply:
visualize{"path":"<absolute fragment path>"}
`;

const cases = [
  {
    skill: 'vs-prototype',
    request: 'Show me exactly three fictional WhatsApp-like message cards with clickable quick replies, here in the conversation. I want to see whether choosing a reply gives clear confirmation. One design, three cards.',
  },
  {
    skill: 'vs-show-me',
    request: 'Let me explore a tiny counter right here in the conversation: an increment button, current count, and reset. Show how pressing reset returns the count to zero.',
  },
] as const;

describe('inline preview behavior', () => {
  it.each(cases)('$skill presents a local interaction in the conversation', async ({ skill, request }) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-inline-'));
    for (const name of [skill, 'vs-internal-shared']) {
      fs.cpSync(path.join(SKILLS, name), path.join(workspace, 'skills', name), {
        recursive: true,
        filter: (source) => !source.split(path.sep).includes('test'),
      });
    }
    const host = path.join(workspace, 'host', 'visualize', 'SKILL.md');
    fs.mkdirSync(path.dirname(host), { recursive: true });
    fs.writeFileSync(host, HOST_SKILL);
    const agent = await createAgent({
      workspace,
      timeout: 300,
      copyFromHome: ['.codex/auth.json'],
    });
    try {
      await promptOnce(agent, `Use skills/${skill}/SKILL.md. ${request}\nHost capabilities: inline rendering is supported; the available visualize skill is at host/visualize/SKILL.md. The writable previews directory is inside your workspace. No app, backend, or browser is running.`);
      const result = await evaluate(agent, [
        check('returns-existing-fragment', () => {
          const final = agent.messages.filter((message) => message.role === 'agent').at(-1)?.content ?? '';
          const match = final.match(/visualize(\{[^\n]+\})/);
          if (!match) return false;
          const file: unknown = JSON.parse(match[1]).path;
          return typeof file === 'string' && path.isAbsolute(file) && fs.existsSync(file);
        }),
        check('authors-interactive-fragment', () => {
          const dir = path.join(agent.workspace, 'previews');
          if (!fs.existsSync(dir)) return false;
          const files = fs.readdirSync(dir).filter((file) => file.endsWith('.html'));
          return files.length === 1 && files.every((file) => {
            const html = fs.readFileSync(path.join(dir, file), 'utf8');
            return /<button\b/.test(html) && /<script\b/.test(html)
              && !/<!doctype|<html\b|text\/htmdx|\bfetch\s*\(|WebSocket/i.test(html);
          });
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
