import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "..");
const SKILL_RAW = fs.readFileSync(path.join(DIR, "SKILL.md"), "utf8");
const REJECT = path.join(DIR, "scripts", "reject-verify-path.mjs");
const FIX = path.join(__dirname, "fixtures", "path-end-state");
const SLOGAN = path.join(FIX, "slogan-only-skill.md");
const COPY = path.join(FIX, "copy-phrases-skill.md");
const BAD_PATH = path.join(FIX, "bad-clean-no-path");
const BAD_END = path.join(FIX, "bad-clean-no-end-state");
const CLEAN = path.join(FIX, "clean-path-end-state");
const CLEAN_BASE = path.join(FIX, "clean-path-end-baseline");

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: "utf8" });
}

describe("vs-verify user path and observable end state", () => {
  it("keeps fixture canaries and invented skill names out of SKILL", () => {
    expect(SKILL_RAW).not.toMatch(/VERIFY_SLOGAN_ONLY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPY_PHRASES_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/VERIFY_CLEAN_NO_PATH_CANARY/);
    expect(SKILL_RAW).not.toMatch(/VERIFY_CLEAN_NO_END_STATE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_PATH_END_STATE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_PATH_END_BASELINE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHOW_ME_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EXPO_AGENT_DEVICE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-show-me|\/vs-expo-device/i);
  });

  it("rejects slogan-only skill and CLEAN runs missing path or end state", () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPY).status).toBe(1);
    expect(reject(COPY).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_PATH).status).toBe(1);
    expect(reject(BAD_PATH).stderr).toMatch(/missing user path or observable end state/);
    expect(reject(BAD_END).status).toBe(1);
    expect(reject(BAD_END).stderr).toMatch(/missing user path or observable end state/);
  });

  it("accepts path plus end state, optional baseline pointer, and this skill", () => {
    expect(SKILL_RAW).toMatch(/skills\/vs-verify\/scripts\/reject-verify-path\.mjs/);
    expect(SKILL_RAW).toMatch(/test\/fixtures\/path-end-state/);
    expect(SKILL_RAW).toMatch(/Do not invent a show-me skill/);
    expect(SKILL_RAW).toMatch(/do not add an Expo agent-device skill/);
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(CLEAN_BASE).status).toBe(0);
    expect(reject(path.join(DIR, "SKILL.md")).status).toBe(0);
  });

  it("exits 2 when a target is missing", () => {
    expect(reject(path.join(FIX, "missing-run.md")).status).toBe(2);
  });
});
