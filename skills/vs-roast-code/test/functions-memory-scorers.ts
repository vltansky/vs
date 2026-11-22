// Scorers for the roast-code deploy-config cases. Pure functions over the agent's final
// answer so `functions-memory-scorers.static.eval.ts` can prove that wrong answers fail.

const SCHEDULERS = /schedulers\.ts|sendVisitReminders|deliverQueuedMessages/;
// A claim that the function's deploy config sets no memory (not a generic "memory exhaustion").
const MISSING_MEMORY = [
  /\b(?:no|missing|without(?: an?)?(?: explicit)?|lacks?|lacking|omits?|omitted|unset|never sets?|implicit|default)\b[^.\n]{0,30}`?\bmemory\b/i,
  /\bmemory\b`?[^.\n]{0,30}\b(?:default|not set|unset|missing|omitted|unspecified|not configured)\b/i,
];
const MEMORY_OK = /\bmemory\b[^.\n]{0,40}\b(?:is|looks|seems|are)\s+(?:fine|ok|okay|adequate|sufficient|covered|handled)\b|already (?:sets?|declares?|has)[^.\n]{0,40}\bmemory\b|\binherit/i;
const RECOMMENDS = /\b(?:set|add|declare|configure|give|raise|bump|specify|use)\b[^.\n]{0,50}(?:`?\bmemory\b|\b\d{3,4}\s*MiB\b|\b\d\s*GiB\b|setGlobalOptions)/i;

/** The answer split into findings: paragraphs and list items. */
export function findings(output: string): string[] {
  return output.split(/\n\s*\n|\n(?=\s*(?:\d+\.|[-*]|#{1,4})\s)/).map((c) => c.trim()).filter(Boolean);
}

function claimsMissingMemory(chunk: string) {
  return MISSING_MEMORY.some((re) => re.test(chunk)) && !MEMORY_OK.test(chunk);
}

/** Findings that say a scheduled function in schedulers.ts runs without a memory setting. */
export function missingMemoryFindings(output: string): string[] {
  return findings(output).filter((c) => SCHEDULERS.test(c) && claimsMissingMemory(c));
}

export function scoreMemoryReview(output: string) {
  const flagged = missingMemoryFindings(output);
  return {
    flags: flagged.length > 0,
    recommends: flagged.some((c) => RECOMMENDS.test(c)),
    cites: flagged.some((c) => /schedulers\.ts:\d+/.test(c)),
    sparesExplicit: !findings(output).some((c) => /reconcile\.ts/.test(c) && !SCHEDULERS.test(c) && claimsMissingMemory(c)),
  };
}

/** With a repo-level default (setGlobalOptions), no function may be reported as missing memory. */
export function flagsCoveredFunctions(output: string) {
  return missingMemoryFindings(output).length > 0 ||
    findings(output).some((c) => /reconcile\.ts/.test(c) && claimsMissingMemory(c));
}
