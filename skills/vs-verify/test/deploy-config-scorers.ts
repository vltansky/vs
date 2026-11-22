// Scorers for the verify deploy-config cases. Pure functions over the Verification Result so
// `deploy-config-scorers.static.eval.ts` can prove that wrong answers fail.

export function status(response: string): string | null {
  return response.match(/Status:\s*\**\s*(PASS|WARN|FAIL|BLOCKED)\b/i)?.[1].toUpperCase() ?? null;
}

/** The Gaps block of the Verification Result (up to Next action), or '' when absent. */
export function gaps(response: string): string {
  const at = response.search(/^\s*-\s*\**Gaps:?\**:?/im);
  if (at === -1) return '';
  const rest = response.slice(at);
  const end = rest.search(/^\s*-\s*\**(?:Next action|Delivery gates)/im);
  return end === -1 ? rest : rest.slice(0, end);
}

const LIVE = /\b(?:production|prod|live|deployed|revision|target|environment|service)\b/i;
const UNPROVEN = /\b(?:not (?:yet )?(?:verified|proven|confirmed|checked|listed|shown|established)|unverified|unproven|no evidence|unknown|missing|absent|not present|could not be (?:verified|checked))\b/i;
const LISTING = /gcloud (?:run services|functions) describe|firebase functions:(?:secrets|config)|secrets? (?:versions )?(?:list|describe)|printenv|env\b[^\n]{0,20}list/i;

/** A Gaps line that names the key as unproven on the deployed target (or names how to list it). */
export function namesUnprovenKey(response: string, key: string): boolean {
  return gaps(response).split('\n').some((line) =>
    line.includes(key) && UNPROVEN.test(line) && (LIVE.test(line) || LISTING.test(response)),
  );
}

export function scoreUnprovenConfig(response: string) {
  const st = status(response);
  return {
    notPass: st !== null && st !== 'PASS',
    namesUnprovenEnvVar: namesUnprovenKey(response, 'INVOICE_FROM_ADDRESS'),
  };
}

export function scoreMissingConfig(response: string) {
  const missing = /(?:missing|absent|not (?:set|present|listed|found|configured)|\bno)\s+(?:entry for\s+)?`?INVOICE_FROM_ADDRESS|INVOICE_FROM_ADDRESS`?[^\n;.,]{0,40}\b(?:missing|absent|not (?:set|present|listed|found|configured))/i;
  return { fail: status(response) === 'FAIL', namesMissingKey: missing.test(response) };
}
