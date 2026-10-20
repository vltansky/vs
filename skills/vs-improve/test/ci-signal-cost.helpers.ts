// Pure scoring helpers for ci-signal-cost.eval.ts, kept here so the static
// eval can pin them against fixture quotes and real reply shapes.

// Codex streams progress notes ("I'm checking X before proposing caching...")
// into the same reply. Drop only those: a paragraph with no table that starts
// with "I'm / I'll / I am / I will / Let me" plus a progress verb. "I'll keep
// Firestore rules on every PR" is an answer and stays.
const NARRATION =
  /^\s*(?:I[’']m|I[’']ll|I am|I will|Let me|Next,? I[’']ll)\s+(?:now\s+|first\s+|also\s+)?(?:check(?:ing)?|read(?:ing)?|look(?:ing)?|inspect(?:ing)?|us(?:e|ing)|go(?:ing)?|pull(?:ing)?|start(?:ing)?|review(?:ing)?|scan(?:ning)?|compar(?:e|ing)|comput(?:e|ing)|aggregat(?:e|ing)|open(?:ing)?|load(?:ing)?|run(?:ning)?|gather(?:ing)?|break(?:ing)?|tally(?:ing)?|count(?:ing)?|group(?:ing)?|map(?:ping)?|cross-check(?:ing)?|verify(?:ing)?|confirm(?:ing)?|validat(?:e|ing)|turn(?:ing)?|build(?:ing)?|treat(?:ing)?|apply(?:ing)?)\b/i;

export function answerOnly(reply: string): string {
  return reply
    .split(/\n{2,}/)
    .filter((para) => para.includes('|') || !NARRATION.test(para))
    .join('\n\n');
}

// First mention of a step that caught nothing (prose, or a table row whose
// real-failures cell is 0).
export const NEVER_FAILED =
  /(?:\b(?:0|zero|no|never|none)\b[^.\n|]{0,40}\b(?:fail(?:ed|ures?)?|caught|catch(?:es)?|real (?:failure|bug|regression)s?)\b)|(?:\bfail(?:ed|ures?)\b[^.\n|]{0,12}\b(?:0|zero|never)\b)|(?:\binfra(?:structure)?[- ]only\b)|(?:\ball (?:\d+ )?(?:failures? )?(?:were |are )?infra)|(?:\b(?:never|not once|nobody)\b[^.\n|]{0,30}\b(?:looked at|opened|referenced|acted on|replied)\b)|(?:\bzero[- ]signal\b)/i;

// Speed-up proposals only: a verb that adds or improves caching, parallel or
// sharded runs, splitting a job, faster installs. Quoting the data ("a 29-minute
// Gradle cache miss", "cache hit restores in 6s") is not a proposal.
export const SPEEDUP = new RegExp(
  [
    String.raw`\bparallel(?:i[sz]e[sd]?|i[sz]ing|ism)\b`,
    String.raw`\bin parallel\b`,
    String.raw`\bshard(?:s|ed|ing)?\b`,
    String.raw`\bmatrix (?:job|build|strategy)s?\b`,
    String.raw`\b(?:add|adding|enable|enabling|use|using|introduce|turn on|warm|warming|pre-?warm|persist|persisting|reuse|reusing|restore|restoring|keep|fix|fixing|improve|improving|share|sharing|key|keying)\s+(?:(?!miss)[\w./-]+\s+){0,4}?cach(?:e|es|ing)\b(?!\s+miss)`,
    String.raw`\bcach(?:e|ing)\s+(?:the\s+)?(?:deps|dependencies|node_modules|npm|pnpm|gradle|apk|build|emulator|avd|installs?)\b(?!\s+miss)`,
    String.raw`\bsplit (?:\S+ ){0,3}(?:into|jobs?)\b`,
    String.raw`\bfaster installs?\b`,
  ].join('|'),
  'i',
);

export function zeroSignalRow(answer: string): number {
  const lines = answer.split('\n');
  let offset = 0;
  let col = -1;
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const header = cells.findIndex((c) => /real|caught|looked|used|acted/i.test(c));
      if (header >= 0 && !/^\d/.test(cells[header])) col = header;
      else if (
        col >= 0 &&
        /^(?:\*\*)?(?:0|none)(?:\*\*)?(?:\s|$|\/)/i.test(cells[col] ?? '') &&
        !/setup|n\/a|not a check/i.test(cells[col] ?? '') &&
        cells[0] &&
        // Setup rows (install, path detection) are not checks, so a 0 there
        // is not a zero-signal claim.
        !/\b(?:install|changes|checkout)\b/i.test(cells[0]) &&
        !cells.some((c) => /^(?:\*\*)?setup\b/i.test(c)) &&
        !/^:?-+:?$/.test(cells[0])
      )
        return offset;
    } else {
      col = -1;
    }
    offset += line.length + 1;
  }
  return -1;
}

// A sentence that names a speed-up only to defer it ("before suggesting
// caching or parallelism", "then discuss caching ... only for steps Vlad
// keeps") is not a speed-up proposal.
const DEFERRED =
  /\bbefore (?:proposing|suggesting|recommending|considering|discussing)\b|\bonly (?:after|for (?:the )?(?:steps|checks|jobs))\b|\bthen discuss\b|\bcome[s]? (?:after|later)\b/i;

function firstSpeedup(answer: string): number {
  const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  for (const m of answer.matchAll(re)) {
    if (DEFERRED.test(m[0])) continue;
    const i = m[0].search(SPEEDUP);
    if (i >= 0) return (m.index ?? 0) + i;
  }
  return -1;
}

export function signalBeforeSpeedup(reply: string) {
  const answer = answerOnly(reply);
  const hits = [answer.search(NEVER_FAILED), zeroSignalRow(answer)].filter((i) => i >= 0);
  const sig = hits.length ? Math.min(...hits) : -1;
  const speed = firstSpeedup(answer);
  return { sig, speed, ok: sig >= 0 && (speed < 0 || sig < speed), answer };
}
