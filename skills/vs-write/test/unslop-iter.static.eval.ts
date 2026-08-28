import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLOP_FIXTURES } from './cases';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_PATH = path.resolve(ROOT, 'skills', 'vs-write', 'SKILL.md');
const RAW = fs.readFileSync(SKILL_PATH, 'utf8');
const SKILL = RAW.replace(/\s+/g, ' ');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const REJECT = path.resolve(
  ROOT,
  'skills',
  'vs-write',
  'scripts',
  'reject-slop.mjs',
);
const REJECT_SRC = fs.readFileSync(REJECT, 'utf8');
const CLOSER = path.join(FIXTURE_DIR, 'bad-closer.md');
const COMPARISON = path.join(FIXTURE_DIR, 'comparison-crutch.md');
const CLEAN = path.join(FIXTURE_DIR, 'clean-deploy-note.md');
const NO_CHAIN = path.join(FIXTURE_DIR, 'structural-no-chain.md');
const DONT_VERB = path.join(FIXTURE_DIR, 'structural-dont-verb-it.md');
const SIT_WITH = path.join(FIXTURE_DIR, 'structural-sit-with.md');
const WHOLE_POINT = path.join(FIXTURE_DIR, 'structural-whole-point.md');
const STACKED_Q = path.join(FIXTURE_DIR, 'structural-stacked-questions.md');
const ECHO_RUN = path.join(FIXTURE_DIR, 'structural-echo-run.md');
const COLON_TRIPLE = path.join(FIXTURE_DIR, 'structural-colon-triple.md');
const DID_NOT_CHAIN = path.join(FIXTURE_DIR, 'structural-did-not-chain.md');
const ALREADY_KNOW = path.join(FIXTURE_DIR, 'structural-already-know.md');
const PUNCHLINE = path.join(FIXTURE_DIR, 'structural-punchline.md');
const HERES_TWIST = path.join(FIXTURE_DIR, 'structural-heres-the-twist.md');
const NOT_NOTHING = path.join(FIXTURE_DIR, 'structural-not-nothing.md');
const WORTH_NAMING = path.join(FIXTURE_DIR, 'structural-worth-naming.md');
const PERF_HONEST = path.join(FIXTURE_DIR, 'structural-performative-honesty.md');
const TAKE_MY_WORD = path.join(FIXTURE_DIR, 'structural-take-my-word.md');
const TURNS_OUT = path.join(FIXTURE_DIR, 'structural-turns-out.md');
const ANAPHORA = path.join(FIXTURE_DIR, 'structural-sentence-anaphora.md');
const NOT_JUST = path.join(FIXTURE_DIR, 'structural-not-just.md');
const AI_LEFTOVERS = path.join(FIXTURE_DIR, 'structural-ai-leftovers.md');
const DESPITE_CHAL = path.join(FIXTURE_DIR, 'structural-despite-challenges.md');
const PARTICIPLE = path.join(FIXTURE_DIR, 'structural-participle-tail.md');
const VAGUE_EXPERTS = path.join(FIXTURE_DIR, 'structural-vague-experts.md');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

describe('vs-write: fixture-backed unslop pins', () => {
  it('names reject-slop.mjs as the rewrite audit step', () => {
    expect(SKILL).toMatch(/skills\/vs-write\/scripts\/reject-slop\.mjs/);
    expect(SKILL).toMatch(/then fix remaining tells/);
    expect(SKILL).not.toMatch(/self-audit/i);
  });

  it('keeps em dashes only for source or requested voice and does not model them', () => {
    expect(SKILL).toMatch(
      /keep an em dash only if (the )?source or requested voice uses them/i,
    );
    expect(RAW).not.toMatch(/\u2014/);
  });

  it('ends on the last concrete fact and reject-slop fails the closer fixture', () => {
    const closer = fs.readFileSync(CLOSER, 'utf8');
    expect(closer).toMatch(/In conclusion/);
    expect(closer).toMatch(/Overall/);
    expect(closer).toMatch(/the future looks bright/);
    expect(REJECT_SRC.length).toBeGreaterThan(200);
    expect(REJECT_SRC).toMatch(/In conclusion/);
    expect(REJECT_SRC).toMatch(/the future looks bright/);
    expect(REJECT_SRC).toMatch(/process\.exit\(1\)/);
    expect(reject(CLOSER).status).toBe(1);
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'task-6-release-announcement.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-ops-note.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-verify-replica.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-ensure-redis.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-confirm-replica.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-please-verify.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-ship-shards.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-verify-class.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-ship-list.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-ship-list-marks.md')).status).toBe(0);
    expect(reject(path.join(FIXTURE_DIR, 'ordinary-ship-numbered.md')).status).toBe(0);
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-verify-replica.md'), 'utf8')).toContain(
      'Verify the redis replica is up. Verify the redis replica is up. Verify the redis replica is up.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ensure-redis.md'), 'utf8')).toContain(
      'Ensure redis is up. Ensure redis is up. Ensure redis is up.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-confirm-replica.md'), 'utf8')).toContain(
      'Confirm the redis replica is healthy. Confirm the redis replica is healthy. Confirm the redis replica is healthy.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-please-verify.md'), 'utf8')).toContain(
      'Please verify redis. Please verify redis. Please verify redis.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-shards.md'), 'utf8')).toContain(
      'Ship the canary to shard B. Ship the canary to shard C. Ship the canary to shard D.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-verify-class.md'), 'utf8')).toContain(
      'Verify redis is up on replica 2 before the join. Verify postgres is up on replica 3 before the join. Verify the queue is draining.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-list.md'), 'utf8')).toContain(
      '- Ship the canary to shard B',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-list.md'), 'utf8')).toContain(
      '- Ship the canary to shard C',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-list.md'), 'utf8')).toContain(
      '- Ship the canary to shard D',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-numbered.md'), 'utf8')).toContain(
      '1. Ship the canary to shard B',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-numbered.md'), 'utf8')).toContain(
      '2. Ship the canary to shard C',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-numbered.md'), 'utf8')).toContain(
      '3. Ship the canary to shard D',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ship-numbered.md'), 'utf8')).not.toMatch(
      /1\. Ship the canary to shard B\./,
    );
    expect(SKILL).toMatch(
      /end the artifact on the last concrete fact, takeaway, or next action/i,
    );
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/bad-closer\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/In conclusion/);
    expect(SKILL).not.toMatch(/Overall/);
    expect(SKILL).not.toMatch(/the future looks bright/);
  });

  it('reject-slop fails comparison-crutch without quoting the tokens in SKILL', () => {
    const comparison = fs.readFileSync(COMPARISON, 'utf8');
    expect(comparison).toMatch(/not X but Y/);
    expect(comparison).toMatch(/if you'?re coming from/i);
    expect(REJECT_SRC).toMatch(/not X but Y/);
    expect(REJECT_SRC).toMatch(/coming from/);
    expect(reject(COMPARISON).status).toBe(1);
    expect(SKILL).toMatch(/stands? without comparison framing/i);
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/comparison-crutch\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/not X but Y/i);
    expect(SKILL).not.toMatch(/if you'?re coming from/i);
  });

  it('registers the slop fixtures in cases.ts', () => {
    expect([...SLOP_FIXTURES]).toEqual([
      'bad-closer.md',
      'comparison-crutch.md',
      'structural-no-chain.md',
      'structural-dont-verb-it.md',
      'structural-sit-with.md',
      'structural-whole-point.md',
      'structural-stacked-questions.md',
      'structural-echo-run.md',
      'structural-colon-triple.md',
      'structural-did-not-chain.md',
      'structural-already-know.md',
      'structural-punchline.md',
      'structural-heres-the-twist.md',
      'structural-not-nothing.md',
      'structural-worth-naming.md',
      'structural-performative-honesty.md',
      'structural-take-my-word.md',
      'structural-turns-out.md',
      'structural-sentence-anaphora.md',
      'structural-not-just.md',
      'structural-ai-leftovers.md',
      'structural-despite-challenges.md',
      'structural-participle-tail.md',
      'structural-vague-experts.md',
    ]);
  });

  it('reject-slop fails structural-no-chain without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(NO_CHAIN, 'utf8');
    expect(body).toMatch(/No fluff, no filler, no jargon/);
    expect(body).toMatch(/NOXYCHAIN_CANARY_K7/);
    expect(reject(NO_CHAIN).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/NOXYCHAIN_CANARY_K7/);
    expect(SKILL).not.toMatch(/No fluff, no filler, no jargon/);
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/structural-no-chain\.md fails the audit/i,
    );
  });

  it('reject-slop fails structural-dont-verb-it without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(DONT_VERB, 'utf8');
    expect(body).toMatch(/Don't call it a rewrite\. Call it a rescue/);
    expect(body).toMatch(/DONTVERBIT_CANARY_K7/);
    expect(reject(DONT_VERB).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/DONTVERBIT_CANARY_K7/);
    expect(SKILL).not.toMatch(/Don't call it a rewrite/);
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/structural-dont-verb-it\.md fails the audit/i,
    );
  });


  it('reject-slop fails structural-sit-with without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(SIT_WITH, 'utf8');
    expect(body).toMatch(/Sit with that for a moment/);
    expect(body).toMatch(/SITWITH_CANARY_K7/);
    expect(reject(SIT_WITH).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/SITWITH_CANARY_K7/);
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/structural-sit-with\\.md fails the audit/i,
    );
  });
  it('reject-slop fails structural-whole-point without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(WHOLE_POINT, 'utf8');
    expect(body).toMatch(/That's the whole point/);
    expect(body).toMatch(/WHOLEPOINT_CANARY_K7/);
    expect(reject(WHOLE_POINT).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/WHOLEPOINT_CANARY_K7/);
    expect(SKILL).not.toMatch(/That's the whole point/);
  });

  it('reject-slop fails structural-stacked-questions without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(STACKED_Q, 'utf8');
    expect(body).toMatch(/Do I know how it works\? Where it breaks\?/);
    expect(body).toMatch(/STACKQ_CANARY_K7/);
    expect(reject(STACKED_Q).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/STACKQ_CANARY_K7/);
    expect(SKILL).not.toMatch(/Do I know how it works\? Where it breaks\?/);
  });

  it('reject-slop fails structural-echo-run without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(ECHO_RUN, 'utf8');
    expect(body).toMatch(/A shopping cart is an object in the system\. A chat room is an object in the system\./);
    expect(body).toMatch(/ECHOSKEL_CANARY_K7/);
    expect(reject(ECHO_RUN).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/ECHOSKEL_CANARY_K7/);
    expect(SKILL).not.toMatch(/is an object in the system/);
  });

  it('reject-slop fails structural-colon-triple without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(COLON_TRIPLE, 'utf8');
    expect(body).toMatch(/three things: a blog post, a demo video, and a pricing page/);
    expect(body).toMatch(/COLONTRIP_CANARY_K7/);
    expect(reject(COLON_TRIPLE).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/COLONTRIP_CANARY_K7/);
    expect(SKILL).not.toMatch(/a blog post, a demo video, and a pricing page/);
  });

  it('reject-slop fails structural-did-not-chain without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(DID_NOT_CHAIN, 'utf8');
    expect(body).toMatch(/Did not flinch, did not blink/);
    expect(body).toMatch(/DIDNOTCHAIN_CANARY_K7/);
    expect(reject(DID_NOT_CHAIN).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/DIDNOTCHAIN_CANARY_K7/);
    expect(SKILL).not.toMatch(/Did not flinch, did not blink/);
  });


  it('reject-slop fails structural-already-know without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(ALREADY_KNOW, 'utf8');
    expect(body).toMatch(/You already know the answer/);
    expect(body).toMatch(/ALREADYKNOW_CANARY_K7/);
    expect(reject(ALREADY_KNOW).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/ALREADYKNOW_CANARY_K7/);
    expect(SKILL).not.toMatch(/You already know the answer/);
  });


  it('reject-slop fails structural-punchline without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(PUNCHLINE, 'utf8');
    expect(body).toMatch(/The punchline is that nobody laughed/);
    expect(body).toMatch(/PUNCHLINE_CANARY_K7/);
    expect(reject(PUNCHLINE).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/PUNCHLINE_CANARY_K7/);
    expect(SKILL).not.toMatch(/The punchline is that nobody laughed/);
  });


  it('reject-slop fails structural-heres-the-twist without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(HERES_TWIST, 'utf8');
    expect(body).toMatch(/Here's the twist: nobody clicked it/);
    expect(body).toMatch(/HERESTWIST_CANARY_K7/);
    expect(reject(HERES_TWIST).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/HERESTWIST_CANARY_K7/);
    expect(SKILL).not.toMatch(/Here's the twist: nobody clicked it/);
  });


  it('reject-slop fails structural-not-nothing without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(NOT_NOTHING, 'utf8');
    expect(body).toMatch(/That's not nothing/);
    expect(body).toMatch(/NOTNOTHING_CANARY_K7/);
    expect(reject(NOT_NOTHING).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/NOTNOTHING_CANARY_K7/);
    expect(SKILL).not.toMatch(/That's not nothing/);
  });


  it('reject-slop fails structural-worth-naming without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(WORTH_NAMING, 'utf8');
    expect(body).toMatch(/It's worth naming that this hurts/);
    expect(body).toMatch(/WORTHNAMING_CANARY_K7/);
    expect(reject(WORTH_NAMING).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/WORTHNAMING_CANARY_K7/);
    expect(SKILL).not.toMatch(/It's worth naming that this hurts/);
  });


  it('reject-slop fails structural-performative-honesty without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(PERF_HONEST, 'utf8');
    expect(body).toMatch(/I won't pretend the rollout was smooth/);
    expect(body).toMatch(/PERFHONEST_CANARY_K7/);
    expect(reject(PERF_HONEST).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/PERFHONEST_CANARY_K7/);
    expect(SKILL).not.toMatch(/I won't pretend the rollout was smooth/);
  });


  it('reject-slop fails structural-take-my-word without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(TAKE_MY_WORD, 'utf8');
    expect(body).toMatch(/Don't take my word for it/);
    expect(body).toMatch(/TAKEMYWORD_CANARY_K7/);
    expect(reject(TAKE_MY_WORD).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/TAKEMYWORD_CANARY_K7/);
    expect(SKILL).not.toMatch(/Don't take my word for it/);
  });


  it('reject-slop fails structural-turns-out without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(TURNS_OUT, 'utf8');
    expect(body).toMatch(/Turns out nobody tested it/);
    expect(body).toMatch(/TURNSOUT_CANARY_K7/);
    expect(reject(TURNS_OUT).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/TURNSOUT_CANARY_K7/);
    expect(SKILL).not.toMatch(/Turns out nobody tested it/);
  });


  it('reject-slop fails structural-sentence-anaphora without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(ANAPHORA, 'utf8');
    expect(body).toMatch(/Maybe nobody needed it\. Maybe the timing was off\. Maybe both\./);
    expect(body).toMatch(/ANAPHORA_CANARY_K7/);
    expect(reject(ANAPHORA).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/ANAPHORA_CANARY_K7/);
    expect(SKILL).not.toMatch(/Maybe nobody needed it\. Maybe the timing was off\. Maybe both\./);
  });


  it('reject-slop fails structural-not-just without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(NOT_JUST, 'utf8');
    expect(body).toMatch(/This is not just a tool, but a philosophy/);
    expect(body).toMatch(/NOTJUST_CANARY_K7/);
    expect(reject(NOT_JUST).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/NOTJUST_CANARY_K7/);
    expect(SKILL).not.toMatch(/This is not just a tool, but a philosophy/);
  });


  it('reject-slop fails structural-ai-leftovers without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(AI_LEFTOVERS, 'utf8');
    expect(body).toMatch(/As of my last update, the API was in beta/);
    expect(body).toMatch(/AILEFTOVER_CANARY_K7/);
    expect(reject(AI_LEFTOVERS).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/AILEFTOVER_CANARY_K7/);
    expect(SKILL).not.toMatch(/As of my last update, the API was in beta/);
  });


  it('reject-slop fails structural-despite-challenges without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(DESPITE_CHAL, 'utf8');
    expect(body).toMatch(/Despite these challenges, growth continued/);
    expect(body).toMatch(/DESPITECHAL_CANARY_K7/);
    expect(reject(DESPITE_CHAL).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/DESPITECHAL_CANARY_K7/);
    expect(SKILL).not.toMatch(/Despite these challenges, growth continued/);
  });


  it('reject-slop fails structural-participle-tail without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(PARTICIPLE, 'utf8');
    expect(body).toMatch(/Sales doubled, underscoring the strength of the brand/);
    expect(body).toMatch(/PARTICIPLE_CANARY_K7/);
    expect(reject(PARTICIPLE).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/PARTICIPLE_CANARY_K7/);
    expect(SKILL).not.toMatch(/Sales doubled, underscoring the strength of the brand/);
  });


  it('reject-slop fails structural-vague-experts without quoting the canary in SKILL', () => {
    const body = fs.readFileSync(VAGUE_EXPERTS, 'utf8');
    expect(body).toMatch(/Experts argue that the policy failed/);
    expect(body).toMatch(/VAGUEEXPERT_CANARY_K7/);
    expect(reject(VAGUE_EXPERTS).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/VAGUEEXPERT_CANARY_K7/);
    expect(SKILL).not.toMatch(/Experts argue that the policy failed/);
  });

  it('does not leave hedge slogans on the artifact', () => {
    expect(SKILL).not.toMatch(/you may want to consider/i);
    expect(SKILL).not.toMatch(/it'?s worth noting/i);
  });
});
