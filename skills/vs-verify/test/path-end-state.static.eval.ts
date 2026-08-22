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
const STUB = path.join(FIX, "stub-rejector", "SKILL.md");
const STRUCTURE = path.join(FIX, "structure-paste", "SKILL.md");
const UI_NO_BASE = path.join(FIX, "ui-no-baseline-verify");
const NO_COMMAND = path.join(FIX, "verify-pass-no-command");
const MD_IMAGE = path.join(FIX, "md-image-no-file");
const BASE_ONLY = path.join(FIX, "baseline-path-only");
const FOUR_WORD = path.join(FIX, "four-word-path");
const CLEAN_SHOT = path.join(FIX, "clean-command-shot");
const CLEAN_NO_VISUAL = path.join(FIX, "clean-no-visual");

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
    expect(SKILL_RAW).not.toMatch(/STUB_REJECTOR_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/STRUCTURE_PASTE_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/UI_NO_BASELINE_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/VERIFY_PASS_NO_COMMAND_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MD_IMAGE_NO_FILE_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BASELINE_PATH_ONLY_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/FOUR_WORD_PATH_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_COMMAND_SHOT_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_NO_VISUAL_VERIFY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHOW_ME_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EXPO_AGENT_DEVICE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-show-me|\/vs-expo-device/i);
  });

  it("rejects slogan-only, stub rejector, structure-paste, and missing path or end state", () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPY).status).toBe(1);
    expect(reject(COPY).stderr).toMatch(/slogan-only skill/);
    expect(reject(STUB).status).toBe(1);
    expect(reject(STUB).stderr).toMatch(/slogan-only skill/);
    expect(reject(STRUCTURE).status).toBe(1);
    expect(reject(STRUCTURE).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_PATH).status).toBe(1);
    expect(reject(BAD_PATH).stderr).toMatch(/missing user path or observable end state/);
    expect(reject(BAD_END).status).toBe(1);
    expect(reject(BAD_END).stderr).toMatch(/missing user path or observable end state/);
    expect(reject(FOUR_WORD).status).toBe(1);
    expect(reject(FOUR_WORD).stderr).toMatch(/missing user path or observable end state/);
  });

  it("rejects UI-in-scope verify with no shot file and PASS with no named command", () => {
    expect(reject(UI_NO_BASE).status).toBe(1);
    expect(reject(UI_NO_BASE).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(NO_COMMAND).status).toBe(1);
    expect(reject(NO_COMMAND).stderr).toMatch(/pass with no named command/);
    expect(reject(MD_IMAGE).status).toBe(1);
    expect(reject(MD_IMAGE).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(BASE_ONLY).status).toBe(1);
    expect(reject(BASE_ONLY).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(path.join(FIX, "clean-path-end-state")).status).toBe(1);
    expect(reject(path.join(FIX, "clean-path-end-baseline")).status).toBe(1);
  });

  it("accepts named command plus real shot file, no-visual pass, and this skill", () => {
    expect(SKILL_RAW).toMatch(/skills\/vs-verify\/scripts\/reject-verify-path\.mjs/);
    expect(SKILL_RAW).toMatch(/test\/fixtures\/path-end-state/);
    expect(SKILL_RAW).toMatch(/Do not invent a show-me skill/);
    expect(SKILL_RAW).toMatch(/do not add an Expo agent-device skill/);
    expect(SKILL_RAW).toMatch(/named command/);
    expect(SKILL_RAW).toMatch(/real screenshot or baseline file/);
    expect(reject(CLEAN_SHOT).status).toBe(0);
    expect(reject(CLEAN_NO_VISUAL).status).toBe(0);
    expect(reject(path.join(DIR, "SKILL.md")).status).toBe(0);
  });

  it("exits 2 when a target is missing", () => {
    expect(reject(path.join(FIX, "missing-run.md")).status).toBe(2);
  });
});
