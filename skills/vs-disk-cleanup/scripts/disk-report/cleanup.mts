// Prints a cleanup script for items from the last scan (~/disk-report/latest.json).
// Usage: node cleanup.mts --group safe [--yes]     all items in a group (safe | review)
//        node cleanup.mts --ids id1,id2 [--yes]    specific items (ids from the page / latest.json)
// --yes drops the interactive y/N prompt (only after the user approved the list).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildScript } from './cleanup-script.mjs';

const LATEST = join(homedir(), 'disk-report', 'latest.json');
const { values } = parseArgs({ options: { group: { type: 'string' }, ids: { type: 'string' }, yes: { type: 'boolean' } } });
if (!existsSync(LATEST)) {
  console.error(`No scan found at ${LATEST}. Run: node ${join(import.meta.dirname, 'scan.mts')}`);
  process.exit(1);
}
if (!values.group && !values.ids) {
  console.error('Pass --group safe|review or --ids a,b (see "id" in ~/disk-report/latest.json).');
  process.exit(1);
}
const data = JSON.parse(readFileSync(LATEST, 'utf8'));
const ids = new Set(values.ids?.split(',') ?? []);
// Excluded items (package-manager caches, in-use) are never emitted, even by id.
const items = data.items.filter((i) => i.group !== 'excluded' && (i.group === values.group || ids.has(i.id)));
const unknown = [...ids].filter((id) => !data.items.some((i) => i.id === id && i.group !== 'excluded'));
if (unknown.length) console.error(`Ignored (unknown or excluded): ${unknown.join(', ')}`);
if (!items.length) { console.error('Nothing matched; no script generated.'); process.exit(1); }
process.stdout.write(buildScript(items, { scannedAt: data.scannedAt, prompt: !values.yes, scanCmd: join(import.meta.dirname, 'scan.mts') }));
