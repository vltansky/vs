import { z } from 'zod';

export const findingSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1200),
  request: z.string().trim().min(1).max(2000),
  evidence: z.array(z.object({
    source: z.string().trim().min(1).max(1000),
    quote: z.string().trim().min(1).max(2000).optional(),
  })).min(1).max(6),
});

export const findingsSchema = z.array(findingSchema).max(12).superRefine((findings, context) => {
  // IDs own each finding's local choices; collisions would silently merge user intent.
  const seen = new Set<string>();
  for (const finding of findings) {
    if (seen.has(finding.id)) context.addIssue({ code: 'custom', message: 'Finding IDs must be unique.' });
    seen.add(finding.id);
  }
});

export const reviewPayloadSchema = z.object({
  artifactPath: z.string().min(1),
  reviewQuestion: z.string().optional(),
  findings: findingsSchema,
  constraints: z.string().max(4000).optional(),
});

export type Finding = z.infer<typeof findingSchema>;
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;
export type ReviewAction = 'draft' | 'investigate' | 'disagree' | 'defer';
export type ReviewChoice = { action: ReviewAction; note: string };

export const reviewActions = new Map<ReviewAction, string>([
  ['draft', 'Draft a change'],
  ['investigate', 'Investigate further'],
  ['disagree', 'I disagree — reassess'],
  ['defer', 'Defer this finding'],
]);

export function buildReviewRequest(payload: ReviewPayload, choices: ReadonlyMap<string, ReviewChoice>, constraints: string) {
  const selected = payload.findings.filter(finding => choices.has(finding.id));
  if (!selected.length) return '';
  const parts = [
    'Review these selected findings. This request does not authorize implementation.',
    `Artifact: ${payload.artifactPath}${payload.reviewQuestion ? `\nReview question: ${payload.reviewQuestion}` : ''}`,
  ];
  // Preserve the report's ordering so the preview and message agree across selections.
  for (const finding of selected) {
    const choice = choices.get(finding.id)!;
    const direction = choice.action === 'defer'
      ? 'Keep this deferred; no investigation or changes.'
      : choice.action === 'disagree'
        ? 'Reassess this inference against the cited evidence before proposing further work.'
        : finding.request;
    parts.push([
      `${reviewActions.get(choice.action)}: ${finding.title}`,
      direction,
      ...finding.evidence.map(evidence => `Source: ${evidence.source}${evidence.quote ? `\nQuote: ${evidence.quote}` : ''}`),
      ...(choice.note.trim() ? [`My direction: ${choice.note.trim()}`] : []),
    ].join('\n'));
  }
  if (constraints.trim()) parts.push(`Constraints:\n${constraints.trim()}`);
  parts.push('Report which findings you addressed or deferred, with evidence. Ask before implementing any proposed change.');
  return parts.join('\n\n');
}
