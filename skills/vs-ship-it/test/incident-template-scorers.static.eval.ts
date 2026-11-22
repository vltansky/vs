import { describe, expect, it } from 'vitest';
import { fencedBody, scoreIncidentBody } from './incident-template-scorers';

const all = (o: Record<string, boolean>) => Object.values(o).every(Boolean);

// From a real branch run (trimmed): every section present and filled with incident facts.
const RIGHT = `Fix payment webhook failures for provider events missing \`data.paymentId\`.

\`\`\`diff
+  if (!event?.data?.paymentId) {
\`\`\`

<details>
<summary>Verification and template details</summary>

## Why

The payment provider sends \`payment.pending\` events without \`data\` → the webhook throws → the provider retries and queues payments.

## Merge danger

- Door: two-way
- Blast radius: local webhook behavior in the payments app

## ADR

- [ ] The required ADR was written before implementation: N/A
- [ ] No ADR is required because: N/A

## Before / after

No screenshots apply: this is a webhook response change.

## Evidence

- On-call replayed one captured event locally and observed 400 instead of 500.

## Rollback plan

Revert this hotfix to restore the previous webhook implementation.

## How to verify

1. POST a captured event without \`data.paymentId\` to the payments webhook.
2. Confirm a 400 response and no thrown 500.

</details>`;

const LABELS_ONLY = `## Why

Hotfix.

## Merge danger

- Door: <!-- one-way | two-way -->
- Blast radius: <!-- local | one app -->

## ADR

- [ ] The required ADR was written before implementation: <!-- link -->
- [ ] No ADR is required because: <!-- reason -->

## Before / after

N/A

## Evidence

N/A

## Rollback plan

N/A

## How to verify

1. <!-- entry point -->
2. <!-- expected result -->`;

const DROPPED = RIGHT.replace(/## Rollback plan[\s\S]*?(?=## How to verify)/, '');
const NO_CHECKLIST = RIGHT.replace(/- \[ \] No ADR is required because: N\/A\n/, '');
const REORDERED = RIGHT.replace(/(## Evidence[\s\S]*?)(## Rollback plan[\s\S]*?)(?=## How to verify)/, '$2$1');

describe('ship-it incident-template scorers', () => {
  it('a body from a real run passes every check', () => {
    expect(scoreIncidentBody(fencedBody('````markdown\n' + RIGHT + '\n````'))).toEqual({ sectionsInOrder: true, checklistKept: true, sectionsCarryFacts: true });
  });
  it('an inner ```diff fence does not hide the body', () => {
    expect(all(scoreIncidentBody(fencedBody('```markdown\n' + RIGHT + '\n```')))).toBe(true);
  });
  it.each([
    ['only "Hotfix." and N/A with leftover labels', LABELS_ONLY],
    ['a dropped section', DROPPED],
    ['a dropped checklist item', NO_CHECKLIST],
    ['reordered sections', REORDERED],
  ])('%s fails', (_n, body) => {
    expect(all(scoreIncidentBody(body))).toBe(false);
  });
  it('leftover labels alone never count as section content', () => {
    expect(scoreIncidentBody(LABELS_ONLY).sectionsCarryFacts).toBe(false);
  });
});
