import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "..");
const SKILL_RAW = fs.readFileSync(path.join(DIR, "SKILL.md"), "utf8");
const REJECT = path.join(DIR, "scripts", "reject-qa-path.mjs");
const FIX = path.join(__dirname, "fixtures", "path-end-state");
const SLOGAN = path.join(FIX, "slogan-only-skill.md");
const COPY = path.join(FIX, "copy-phrases-skill.md");
const BAD_PATH = path.join(FIX, "bad-clean-no-path");
const BAD_SHOT = path.join(FIX, "bad-pass-no-shot");
const CLEAN_SHOT = path.join(FIX, "clean-path-end-shot");
const CLEAN_BASE = path.join(FIX, "clean-path-end-baseline");
const CLEAN_EXPO = path.join(FIX, "clean-expo-shot");

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: "utf8" });
}

describe("vs-qa user path, end state, and visual baseline", () => {
  it("keeps fixture canaries and invented skill names out of SKILL", () => {
    expect(SKILL_RAW).not.toMatch(/QA_SLOGAN_ONLY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPY_PHRASES_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/QA_CLEAN_NO_PATH_CANARY/);
    expect(SKILL_RAW).not.toMatch(/QA_PASS_NO_SHOT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_QA_PATH_END_SHOT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_QA_PATH_END_BASELINE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_QA_EXPO_SHOT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHOW_ME_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EXPO_AGENT_DEVICE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-show-me|\/vs-expo-device/i);
  });

  it("rejects slogan-only skill, missing path, and visual pass with no shot", () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPY).status).toBe(1);
    expect(reject(COPY).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_PATH).status).toBe(1);
    expect(reject(BAD_PATH).stderr).toMatch(/missing user path or observable end state/);
    expect(reject(BAD_SHOT).status).toBe(1);
    expect(reject(BAD_SHOT).stderr).toMatch(/pass with no shot or baseline/);
  });

  it("accepts path plus end state plus shot or baseline, Expo shot, and this skill", () => {
    expect(SKILL_RAW).toMatch(/skills\/vs-qa\/scripts\/reject-qa-path\.mjs/);
    expect(SKILL_RAW).toMatch(/test\/fixtures\/path-end-state/);
    expect(SKILL_RAW).toMatch(/Do not\s+invent a show-me skill/);
    expect(SKILL_RAW).toMatch(/Do not add an Expo agent-device skill/);
    expect(reject(CLEAN_SHOT).status).toBe(0);
    expect(reject(CLEAN_BASE).status).toBe(0);
    expect(reject(CLEAN_EXPO).status).toBe(0);
    expect(reject(path.join(DIR, "SKILL.md")).status).toBe(0);
  });

  it("exits 2 when a target is missing", () => {
    expect(reject(path.join(FIX, "missing-run.md")).status).toBe(2);
  });
});
