import { describe, expect, it } from 'vitest';
import { scoreMissingConfig, scoreUnprovenConfig } from './deploy-config-scorers';

const all = (o: Record<string, boolean>) => Object.values(o).every(Boolean);

const RIGHT_UNPROVEN = [
  `## Verification Result

- Status: WARN
- Claim: Invoice reminders release is deployed to production.
- Evidence:
  - \`deploy-log.txt\` — successful update; served revision matches build.
- Gaps:
  - \`INVOICE_FROM_ADDRESS\` presence on the deployed revision was not verified.
  - The scheduled invoice-reminder path was not exercised.
- Next action:
  - Run \`gcloud run services describe sendinvoicereminders\` and check the env names.`,
  `- Status: WARN
- Gaps:
  - Production configuration was not verified: \`INVOICE_FROM_ADDRESS\` (plain env var).
- Next action:
  - List the env of the live revision.`,
];

const WRONG_UNPROVEN: Record<string, string> = {
  'reads the code, calls it proven': `- Status: WARN
- Evidence:
  - I checked src/invoice-reminders.ts reads INVOICE_MAIL_API_KEY and INVOICE_FROM_ADDRESS.
- Gaps:
  - none`,
  'PASS on a green smoke': `- Status: PASS
- Evidence:
  - smoke ok (HTTP 200)
- Gaps:
  - none`,
  'gap without the key': `- Status: WARN
- Gaps:
  - Production config was not verified.`,
  'key only in Next action': `- Status: WARN
- Gaps:
  - The reminder path was not exercised.
- Next action:
  - Check INVOICE_FROM_ADDRESS in production.`,
};

describe('verify deploy-config scorers', () => {
  it.each(RIGHT_UNPROVEN.map((r, i) => [i, r]))('right unproven-config answer %i passes', (_i, r) => {
    expect(scoreUnprovenConfig(r as string)).toEqual({ notPass: true, namesUnprovenEnvVar: true });
  });
  it.each(Object.entries(WRONG_UNPROVEN))('wrong answer "%s" fails', (_n, w) => {
    expect(all(scoreUnprovenConfig(w))).toBe(false);
  });
  it('missing-config FAIL needs the FAIL status and the missing key', () => {
    expect(scoreMissingConfig('- Status: FAIL\n- Gaps:\n  - `INVOICE_FROM_ADDRESS` is not set on the live revision.')).toEqual({ fail: true, namesMissingKey: true });
    expect(all(scoreMissingConfig('- Status: WARN\n- Gaps:\n  - `INVOICE_FROM_ADDRESS` is missing.'))).toBe(false);
    expect(all(scoreMissingConfig('- Status: FAIL\n- Evidence:\n  - healthz failed.'))).toBe(false);
    expect(all(scoreMissingConfig('- Status: FAIL\n- Evidence:\n  - `INVOICE_FROM_ADDRESS` is present; `INVOICE_MAIL_API_KEY` is missing.'))).toBe(false);
  });
});
