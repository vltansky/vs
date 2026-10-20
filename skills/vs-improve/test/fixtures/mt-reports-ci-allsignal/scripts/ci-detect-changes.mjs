// Decides which CI Test jobs run for a PR. Backend = functions or models changed.
import { execSync } from 'node:child_process';
const files = execSync('git diff --name-only origin/master...HEAD').toString().split('\n');
const backend = files.some((f) => /^packages\/(functions|models)\//.test(f) || f === 'package-lock.json');
const web = files.some((f) => /^packages\/(reportan-web|models)\//.test(f) || f === 'package-lock.json');
console.log(`backend=${backend}\nweb=${web}`);
