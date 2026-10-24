#!/usr/bin/env node
// Builds the quiz a fresh reader answers from the beats alone, before any voice
// is made: three questions from script.json "quiz" (why it broke, what the
// change does, why it is safe). Text only, so it is cheap; it runs once.
//
//   node quiz.mjs <work-dir> [--head <ref>]
//
// Writes <work-dir>/quiz/BRIEF.md (the beats and the questions, no answers) and
// prints the expected answers for the maker to compare with the reply.
// It first checks the beats against <work-dir>/diff.json (diff.mjs): every
// changed file is in "covers" or "skip". With no diff.json, script.json must
// say the topic is not a change: "diff": {"none": "<why>"}. diff.json must be
// for the current head (--head, else the ref diff.mjs was given).
// Exit codes: 0 brief written; 1 the quiz already ran, or a changed file is not
// covered, or diff.json is missing with no reason; 2 blocked (no script, or a quiz without 3 questions and answers).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { quizIssues } from './checks.mjs';
import { coverageIssues, headIssues, isMinor, noDiffIssues } from './diff.mjs';
import { fail } from './media.mjs';

const argv = process.argv.slice(2);
const headAt = argv.indexOf('--head');
const pinnedHead = headAt === -1 ? undefined : argv[headAt + 1];
const [workArg] = argv.filter((arg, i) => !arg.startsWith('--') && !(headAt !== -1 && i === headAt + 1));
if (!workArg) fail('Usage: node quiz.mjs <work-dir>');
const work = path.resolve(workArg);
const scriptFile = path.join(work, 'script.json');
if (!existsSync(scriptFile)) fail(`${scriptFile} is missing. Write the beats first.`);
const script = JSON.parse(readFileSync(scriptFile, 'utf8'));
const issues = quizIssues(script);
if (issues.length) fail(`${issues.join('; ')}. Add the quiz to script.json (references/scenarist.md), then rerun quiz.mjs.`);
// A branch or PR has diff.json (diff.mjs), and the beats must cover it first.
// Anything else must opt out with a reason, so a skipped diff.mjs is never silent.
const diffFile = path.join(work, 'diff.json');
const diff = existsSync(diffFile) ? JSON.parse(readFileSync(diffFile, 'utf8')) : null;
const gaps = diff ? [...headIssues(diff, pinnedHead), ...coverageIssues(script, diff)] : noDiffIssues(script);
if (gaps.length) {
  process.stdout.write(`${JSON.stringify({
    problems: gaps,
    next: diff
      ? 'The beats do not match the diff. Add a beat for each uncovered change, fix "covers" and "skip" in script.json, then rerun quiz.mjs.'
      : 'Run diff.mjs <work-dir> for a branch or PR and write the beats from it; only a topic that is not a change sets "diff": {"none": "<why>"}. Then rerun quiz.mjs.',
  }, null, 2)}\n`);
  process.exit(1);
}
const dir = path.join(work, 'quiz');
const brief = path.join(dir, 'BRIEF.md');
if (existsSync(brief)) {
  process.stdout.write(`${JSON.stringify({
    error: `${brief} already exists`,
    next: 'The quiz runs once. Narrate now; a gap it found is fixed once in the beats, never quizzed again.',
  }, null, 2)}\n`);
  process.exit(1);
}

const text = [
  'You are a teammate who knows the product but has never read this code.',
  'Below is everything a short explainer video says, one line at a time.',
  'Read it once. Then answer each question in one line, using only these',
  'lines. If the lines do not say it, write "not said" and your guess. Do',
  'not open any file.',
  '',
  `## ${script.title ?? 'The video'}`,
  '',
  ...script.scenes.flatMap((scene) => [`### ${scene.title ?? scene.id}`, ...scene.beats.map((beat) => `- ${beat}`), '']),
  '## Questions',
  '',
  ...script.quiz.map((item, i) => `${i + 1}. ${item.q}`),
  '',
].join('\n');
mkdirSync(dir, { recursive: true });
writeFileSync(brief, text);
process.stdout.write(`${JSON.stringify({
  brief,
  expected: script.quiz,
  minor: diff ? diff.files.filter(isMinor).map((f) => f.path) : [],
  next: `Give ${brief}, and nothing else, to a NEW agent. Compare each answer with "expected". A wrong answer or "not said" means a beat is missing: add it to script.json once, then narrate. Do not quiz again.`,
}, null, 2)}\n`);
