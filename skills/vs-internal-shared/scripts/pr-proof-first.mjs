// The marker lets refresh and video attachment select the new format on live PRs
// while descriptions written by an older plugin keep their original parser.
const MARKER = '<!-- vs:proof-first -->';
const expanderStart = /^<details>[ \t]*\r?\n<summary>([^<>\r\n]+)<\/summary>[ \t]*\r?\n\s*<!-- vs:proof-first -->[ \t]*$/im;
export const walkthroughHeading = /^##[ \t]+Walkthrough(?:[: \t][^\r\n]*)?$/im;
const riskLine = /^\*\*Risk:\*\*[ \t]+(\S.*)$/i;
const blockerPrefix = /^Block merge until\b/i;
const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });

const blank = (text) => text.replace(/[^\r\n]/g, ' ');

// Preserve offsets when looking for structural markup, never for rendered prose.
export const maskFences = (text) => text
  .replace(/^[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?^[ \t]*\1[`~]*[ \t]*\r?$/gm, blank)
  .replace(/`[^`\r\n]+`/g, blank);

export function proofFirstLayout(body, required = false) {
  const masked = maskFences(body);
  if (!required && !masked.split(/\r?\n/).some((line) => line.trim() === MARKER)) return null;

  const reasons = [];
  const start = masked.match(expanderStart);
  const tags = [...masked.replace(/<!--[\s\S]*?-->/g, blank).matchAll(/<\/?details\b[^>]*>/gi)];
  const [open, close] = tags;
  const hasExpander = start && start[1].trim() && tags.length === 2 &&
    open.index === start.index && /^<\/details\s*>$/i.test(close[0]) &&
    close.index >= start.index + start[0].length && !masked.slice(close.index + close[0].length).trim();
  if (!hasExpander) reasons.push('end with exactly one closed <details> expander with a <summary> and the vs:proof-first marker');
  const visible = body.slice(0, start?.index ?? open?.index ?? body.length);
  const details = hasExpander ? {
    content: body.slice(start.index + start[0].length, close.index),
    start: start.index + start[0].length,
    end: close.index,
  } : null;
  if (details && !details.content.trim()) reasons.push('put supporting evidence or context inside the expander');

  const blocks = visible.replace(/^\uFEFF/, '').trim().split(/\r?\n[ \t]*\r?\n/).map((block) => block.trim());
  const riskLines = maskFences(visible).split(/\r?\n/).filter((line) => riskLine.test(line.trim()));
  const firstRisk = blocks[0].match(riskLine);
  const lastRisk = blocks.at(-1).match(riskLine);
  const blocker = riskLines.some((line) => blockerPrefix.test(line.trim().match(riskLine)[1]));
  const summary = blocks[blocker ? 1 : 0] ?? '';
  if (riskLines.length !== 1) reasons.push('write exactly one visible **Risk:** line');
  if (blocker && (!firstRisk || !blockerPrefix.test(firstRisk[1]))) reasons.push('put a merge blocker first as **Risk:** Block merge until …');
  if (!blocker && !lastRisk) reasons.push('put the risk line after the Before/After proof and immediately before the expander');
  if (!summary || /[\r\n]/.test(summary) || /^(?:#|[-*+>|][ \t]|\d+[.)][ \t]|\*\*|__|<)/.test(summary) ||
      [...sentences.segment(summary)].length !== 1) {
    reasons.push('write one standalone sentence about what changes, immediately before the proof');
  }
  const proof = blocks.slice(blocker ? 2 : 1, blocker ? blocks.length : -1).join('\n\n');
  if (!proof || /^##[ \t]+(?:Review map|Change and proof|Verification|Walkthrough)\b/im.test(maskFences(proof))) {
    reasons.push('keep only the Before/After proof between the summary and the details or risk line');
  }
  return { proof, details, risk: firstRisk?.[1] ?? lastRisk?.[1] ?? null, blocker, reasons, ok: reasons.length === 0 };
}
