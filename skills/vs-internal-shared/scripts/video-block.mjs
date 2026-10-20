// The PR video explainer lives between two marker lines in the PR body:
//   <!-- vs:video -->
//   <details><summary>Video explainer (N s)</summary> ... </details>
//   <!-- /vs:video -->
// Only vs-explain-pr writes it. Everything else that rewrites the body keeps it
// with keepVideoBlock(). A marker counts only on its own line and outside a code
// fence, so prose or an example that quotes the marker is not a block.
import { closeSync, openSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIDEO_START = '<!-- vs:video -->';
export const VIDEO_END = '<!-- /vs:video -->';

const OPEN_LINE = /^<!-- vs:video -->[ \t]*$/;
const CLOSE_LINE = /^<!-- \/vs:video -->[ \t]*$/;
const FENCE_LINE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const DETAILS_END = /<\/details>[ \t]*$/i;
const WALKTHROUGH = /<details\b[^>]*>\s*<summary\b[^>]*>\s*(?:<(?:b|strong)>\s*)?Walkthrough\b/i;

// Lines with their start offsets; `fenced` marks lines inside (or opening/closing) a code fence.
function lines(body) {
  const out = [];
  let at = 0;
  let fence = null;
  for (const raw of body.split('\n')) {
    const text = raw.replace(/\r$/, '');
    const open = text.match(FENCE_LINE);
    let fenced = fence !== null;
    if (fence === null && open) { fence = open[1]; fenced = true; }
    else if (fence !== null && open && open[1][0] === fence[0] && open[1].length >= fence.length && text.trim() === open[1]) fence = null;
    out.push({ text, start: at, end: at + raw.length, fenced });
    at += raw.length + 1;
  }
  return out;
}

// Every marked span outside code fences.
// kind: 'block' (opener ... closer), 'open' (an opener with no closer; the span runs to
// the first </details> before the next marker, else the opener line alone), or
// 'close' (a closer with no opener; the line alone).
export function findVideoBlocks(body) {
  const ls = lines(body);
  const spans = [];
  for (let i = 0; i < ls.length; i += 1) {
    const line = ls[i];
    if (line.fenced) continue;
    if (CLOSE_LINE.test(line.text)) { spans.push({ kind: 'close', start: line.start, end: line.end }); continue; }
    if (!OPEN_LINE.test(line.text)) continue;
    let j = i + 1;
    let detailsEnd = -1;
    for (; j < ls.length; j += 1) {
      if (ls[j].fenced) continue;
      if (CLOSE_LINE.test(ls[j].text) || OPEN_LINE.test(ls[j].text)) break;
      if (detailsEnd === -1 && DETAILS_END.test(ls[j].text)) detailsEnd = j;
    }
    if (j < ls.length && CLOSE_LINE.test(ls[j].text)) {
      spans.push({ kind: 'block', start: line.start, end: ls[j].end });
      i = j;
    } else {
      // A lone opener owns the next <details> only when it is the explainer's, so
      // it never swallows a Walkthrough or other section that follows it.
      const head = ls.slice(i + 1, i + 6).filter((l) => l.text.trim()).slice(0, 2).map((l) => l.text).join(' ');
      const ownsDetails = /^[ \t]*<details\b[^>]*>\s*(?:<summary\b[^>]*>\s*)?(?:Video explainer|$)/i.test(head) && /<summary\b[^>]*>\s*Video explainer/i.test(head);
      const last = detailsEnd !== -1 && ownsDetails ? detailsEnd : i;
      spans.push({ kind: 'open', start: line.start, end: ls[last].end });
      i = last;
    }
  }
  return spans.map((s) => ({ ...s, text: body.slice(s.start, s.end) }));
}

// Offset of the Walkthrough <details>, outside code fences, or -1.
export function walkthroughOffset(body) {
  // Blank fenced lines (same length) so the search keeps offsets but skips examples.
  const masked = lines(body).map((l) => (l.fenced ? ' '.repeat(l.end - l.start) : body.slice(l.start, l.end))).join('\n');
  return masked.search(WALKTHROUGH);
}

// The body with every marked span cut out (for checks that must not see the video).
export function stripVideoBlocks(body) {
  let out = '';
  let at = 0;
  for (const span of findVideoBlocks(body)) {
    out += body.slice(at, span.start);
    at = span.end;
  }
  return out + body.slice(at);
}

// Put `block` in the body: in place of the first marked span (a whole block or a
// lone marker), removing any other spans, so a broken body ends with exactly one
// block. With no span, insert it before the Walkthrough, else append it.
// Everything outside the spans stays byte for byte.
export function upsertVideoBlock(body, block) {
  const spans = findVideoBlocks(body);
  // A span after the Walkthrough (a stray marker) must not decide where the block
  // goes: the gate rejects that spot, and a rerun would land there again. Cut every
  // span, then insert before the Walkthrough.
  const walkAt = walkthroughOffset(body);
  if (spans.length > 0 && walkAt !== -1 && spans[0].start > walkAt) return upsertVideoBlock(cutSpans(body, spans), block);
  if (spans.length > 0) {
    let out = '';
    let at = 0;
    spans.forEach((span, n) => {
      out += body.slice(at, span.start) + (n === 0 ? block : '');
      at = span.end;
      // Drop the line break after a removed span, so no blank lines pile up.
      if (n > 0 && body[at] === '\n') at += 1;
    });
    return out + body.slice(at);
  }
  const walk = walkthroughOffset(body);
  if (walk !== -1) return `${body.slice(0, walk)}${block}\n\n${body.slice(walk)}`;
  return `${body.replace(/\s*$/, '')}\n\n${block}\n`;
}

// The body with every span cut, each with the blank line that followed it, so
// nothing piles up where a span was.
function cutSpans(body, spans) {
  let out = '';
  let at = 0;
  for (const span of spans) {
    out += body.slice(at, span.start);
    at = span.end;
    while (body[at] === '\n' && (body[at + 1] === '\n' || at + 1 >= body.length)) at += 1;
    if (body[at] === '\n') at += 1;
  }
  const rest = out + body.slice(at);
  return /\n$/.test(body) ? rest.replace(/\n+$/, '\n') : rest.replace(/\n+$/, '');
}

// The live video block (a complete one), or null.
export function liveVideoBlock(body) {
  return findVideoBlocks(body ?? '').find((s) => s.kind === 'block')?.text ?? null;
}

// For any body rewrite after the PR exists: carry the live body's video block into
// the new body. With no block live, the new body is returned unchanged.
export function keepVideoBlock(newBody, liveBody) {
  const block = liveVideoBlock(liveBody);
  return block ? upsertVideoBlock(newBody, block) : newBody;
}

// Child output goes to files, not pipes: the Codex Linux sandbox drops piped
// child output, while file descriptors work everywhere.
export function runToFiles(cmd, args, scratch = mkdtempSync(path.join(tmpdir(), 'vs-run-'))) {
  const outFile = path.join(scratch, `out-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const errFile = `${outFile}.err`;
  const fds = [openSync(outFile, 'w'), openSync(errFile, 'w')];
  const result = spawnSync(cmd, args, { stdio: ['ignore', ...fds] });
  fds.forEach(closeSync);
  return { status: result.status, stdout: readFileSync(outFile, 'utf8'), stderr: readFileSync(errFile, 'utf8') || (result.error?.message ?? '') };
}

// CLI: node video-block.mjs keep --repo owner/name --pr N <body-file>
// Reads the live PR body over REST and rewrites <body-file> in place with the live
// video block carried over. Run it right before every body update after the PR exists.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const repo = opt('--repo');
  const pr = opt('--pr');
  const file = args.filter((a, i) => !a.startsWith('--') && !['--repo', '--pr'].includes(args[i - 1]))[1];
  if (args[0] !== 'keep' || !repo || !pr || !file) {
    process.stderr.write('Usage: video-block.mjs keep --repo owner/name --pr N <body-file>\n');
    process.exit(2);
  }
  const live = runToFiles('gh', ['api', `repos/${repo}/pulls/${pr}`, '--jq', '.body']);
  if (live.status !== 0) {
    process.stderr.write(`video-block: could not read the live body: ${live.stderr.trim().slice(0, 300)}\nDo not update the body until it reads.\n`);
    process.exit(1);
  }
  const next = keepVideoBlock(readFileSync(file, 'utf8'), live.stdout.replace(/\n$/, ''));
  writeFileSync(file, next);
  process.stdout.write(`${JSON.stringify({ kept: liveVideoBlock(live.stdout) !== null, file })}\n`);
}
