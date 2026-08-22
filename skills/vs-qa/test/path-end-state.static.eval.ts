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
const STUB = path.join(FIX, "stub-rejector", "SKILL.md");
const STRUCTURE = path.join(FIX, "structure-paste", "SKILL.md");
const UI_NO_BASE = path.join(FIX, "ui-no-baseline-verify");
const MD_IMAGE = path.join(FIX, "md-image-no-file");
const BASE_ONLY = path.join(FIX, "baseline-path-only");
const FOUR_WORD = path.join(FIX, "four-word-path");
const CLEAN_TABLE = path.join(FIX, "clean-table-shot");
const CLEAN_EXPO = path.join(FIX, "clean-expo-file");
const CLEAN_NO_VISUAL = path.join(FIX, "clean-no-visual");
const PHRASE = path.join(FIX, "phrase-complete-beside", "SKILL.md");
const MAGIC_PNG = path.join(FIX, "magic-only-png");
const MAGIC_JPEG = path.join(FIX, "magic-only-jpeg");
const COMMAND_XX = path.join(FIX, "command-xx");
const SOF_JPEG = path.join(FIX, "sof-only-jpeg");
const VP8X = path.join(FIX, "vp8x-stub");
const IHDR_NO_IDAT = path.join(FIX, "ihdr-no-idat");
const EMPTY_JSON = path.join(FIX, "empty-json-baseline");
const SOS_NO_SCAN = path.join(FIX, "sos-no-scan");
const VP8_1BYTE = path.join(FIX, "vp8-1byte");
const ARRAY_JSON = path.join(FIX, "array-json-baseline");
const PUBLISHED = path.join(FIX, "published-pair", "SKILL.md");
const TEMPLATE = path.join(DIR, "references", "qa-report-template.md");
const HTML_TEMPLATE = path.join(DIR, "references", "qa-report-template.html");

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
    expect(SKILL_RAW).not.toMatch(/STUB_REJECTOR_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/STRUCTURE_PASTE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/UI_NO_BASELINE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/QA_PASS_NO_COMMAND_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MD_IMAGE_NO_FILE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BASELINE_PATH_ONLY_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/FOUR_WORD_PATH_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_QA_TABLE_SHOT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_QA_EXPO_FILE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_QA_NO_VISUAL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHRASE_COMPLETE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MAGIC_ONLY_PNG_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MAGIC_ONLY_JPEG_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COMMAND_XX_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SOF_ONLY_JPEG_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/VP8X_STUB_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/IHDR_NO_IDAT_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EMPTY_JSON_BASELINE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SOS_NO_SCAN_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/VP8_1BYTE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/ARRAY_JSON_BASELINE_QA_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHOW_ME_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EXPO_AGENT_DEVICE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-show-me|\/vs-expo-device/i);
  });

  it("rejects slogan-only, stub rejector, structure-paste, missing path, and four-word path", () => {
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
    expect(reject(FOUR_WORD).status).toBe(1);
    expect(reject(FOUR_WORD).stderr).toMatch(/missing user path or observable end state/);
    expect(reject(TEMPLATE).status).toBe(1);
    expect(reject(TEMPLATE).stderr).toMatch(/missing user path or observable end state/);
    expect(reject(HTML_TEMPLATE).status).toBe(1);
    expect(reject(HTML_TEMPLATE).stderr).toMatch(/missing user path or observable end state/);
  });

  it("rejects visual pass with markdown image or baseline path but no file on disk", () => {
    expect(reject(BAD_SHOT).status).toBe(1);
    expect(reject(BAD_SHOT).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(UI_NO_BASE).status).toBe(1);
    expect(reject(UI_NO_BASE).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(MD_IMAGE).status).toBe(1);
    expect(reject(MD_IMAGE).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(BASE_ONLY).status).toBe(1);
    expect(reject(BASE_ONLY).stderr).toMatch(/pass with no shot or baseline file/);
    expect(reject(path.join(FIX, "clean-path-end-shot")).status).toBe(1);
    expect(reject(path.join(FIX, "clean-path-end-baseline")).status).toBe(1);
    expect(reject(path.join(FIX, "clean-expo-shot")).status).toBe(1);
    expect(reject(path.join(FIX, "verify-pass-no-command")).status).toBe(1);
    expect(reject(path.join(FIX, "verify-pass-no-command")).stderr).toMatch(/pass with no named command/);
  });

  it("rejects phrase-complete beside the live tree, magic-only headers, and Command: xx", () => {
    expect(reject(PHRASE).status).toBe(1);
    expect(reject(MAGIC_PNG).status).toBe(1);
    expect(reject(MAGIC_JPEG).status).toBe(1);
    expect(reject(SOF_JPEG).status).toBe(1);
    expect(reject(VP8X).status).toBe(1);
    expect(reject(IHDR_NO_IDAT).status).toBe(1);
    expect(reject(EMPTY_JSON).status).toBe(1);
    expect(reject(SOS_NO_SCAN).status).toBe(1);
    expect(reject(VP8_1BYTE).status).toBe(1);
    expect(reject(ARRAY_JSON).status).toBe(1);
    expect(reject(COMMAND_XX).status).toBe(1);
    expect(reject(COMMAND_XX).stderr).toMatch(/pass with no named command/);
    const beside = path.join(DIR, "phrase-complete-beside.md");
    fs.writeFileSync(beside, fs.readFileSync(PHRASE));
    try {
      expect(reject(beside).status).toBe(1);
    } finally {
      fs.unlinkSync(beside);
    }
  });

  it("accepts shipped table fields plus real shot, Expo file on disk, no-visual pass, and this skill", () => {
    expect(SKILL_RAW).toMatch(/skills\/vs-qa\/scripts\/reject-qa-path\.mjs/);
    expect(SKILL_RAW).toMatch(/test\/fixtures\/path-end-state/);
    expect(SKILL_RAW).toMatch(/Do not\s+invent a show-me skill/);
    expect(SKILL_RAW).toMatch(/Do not add an Expo agent-device skill/);
    expect(SKILL_RAW).toMatch(/file on disk/);
    expect(SKILL_RAW).toMatch(/named command/);
    expect(SKILL_RAW).toMatch(/image magic/);
    expect(SKILL_RAW).toMatch(/this rejector/);
    expect(SKILL_RAW).toMatch(/live skill path/);
    expect(SKILL_RAW).toMatch(/published-rejector hash/);
    expect(SKILL_RAW).toMatch(/IHDR/);
    expect(reject(CLEAN_TABLE).status).toBe(0);
    expect(reject(CLEAN_EXPO).status).toBe(0);
    expect(reject(CLEAN_NO_VISUAL).status).toBe(0);
    expect(reject(PUBLISHED).status).toBe(0);
    expect(reject(path.join(DIR, "SKILL.md")).status).toBe(0);
  });

  it("exits 2 when a target is missing", () => {
    expect(reject(path.join(FIX, "missing-run.md")).status).toBe(2);
  });
});
