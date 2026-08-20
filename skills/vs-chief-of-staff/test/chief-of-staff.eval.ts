import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

describe('vs-chief-of-staff behavior', () => {
  it('coordinates live tasks without taking over their work', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
    });

    try {
      await promptOnce(
        agent,
        `Act as my live Codex task control tower. Assume list_threads and read_thread already returned this evidence:

- SEO task: waiting for my answer to "Approve the visual layout before push?"
- CloudStore task: tests are actively running; no decision is needed.
- Flights task: I just told this control task "also compare Heathrow" and that instruction belongs to the Flights task.
- Auth task: read_thread timed out at the thread-service layer.

The fixture cannot expose real Codex task tools. Return a concise action plan naming the exact host tools you would call next. Show how continuous waiting and the user question work. Do not perform SEO, flight, auth, or CloudStore work yourself.`,
      );

      const result = await evaluate(
        agent,
        [
          check('popup-real-decision', ({ transcript }) =>
            /request_user_input[\s\S]*(SEO|visual layout|approve)/i.test(transcript),
          ),
          check('route-domain-followup', ({ transcript }) =>
            /send_message_to_thread[\s\S]*(Flights|Heathrow)/i.test(transcript),
          ),
          check('stateful-wait', ({ transcript }) =>
            /wait_threads[\s\S]*(afterCursor|cursor)[\s\S]*(300000|600000|five minutes|ten minutes|longest supported)/i.test(transcript),
          ),
          check('no-minute-poll-loop', ({ transcript }) =>
            !/(every|each|at most)\s+60\s*(seconds|s)|timeoutMs\s*[:=]\s*60000\b/i.test(transcript),
          ),
          check('timeout-is-unknown', ({ transcript }) =>
            /(Auth|timeout)[\s\S]*unknown/i.test(transcript) &&
            !/Auth(?: task)?\s*(?:is|—|-|:)\s*(?:stalled|stuck)/i.test(transcript),
          ),
          check('does-not-take-over', ({ transcript }) =>
            /do not|won't|would not|never/i.test(transcript) &&
            /take over|perform.*work|execute.*work/i.test(transcript),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
