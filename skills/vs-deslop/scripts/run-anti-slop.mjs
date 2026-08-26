// Run Dillon Mulroy anti-slop Oxlint rules on named files only.
// Does not write oxlint.config into the consumer repo.
//
//   node run-anti-slop.mjs <file.ts> [file.ts ...]
//
// Exit 0 on clean files. Exit 1 when a generic (or Effect, when the
// target repo uses Effect) anti-slop rule fails. Exit 2 when oxlint
// or the plugin cannot run. Treat 2 as not checked, not a pass.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GENERIC_CONFIG = join(SCRIPT_DIR, "anti-slop.oxlintrc.json");
const EFFECT_CONFIG = join(SCRIPT_DIR, "anti-slop-effect.oxlintrc.json");
const JS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node run-anti-slop.mjs <file.ts> [file.ts ...]");
  process.exit(2);
}

const files = [];
for (const raw of args) {
  const file = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  let stat;
  try {
    stat = statSync(file);
  } catch (error) {
    console.error("Cannot read " + file + ": " + (error.code ?? error.message));
    process.exit(2);
  }
  if (!stat.isFile()) {
    console.error("run-anti-slop: not a file: " + file);
    process.exit(2);
  }
  if (JS_EXTS.has(extname(file))) files.push(file);
}

if (files.length === 0) {
  console.error("run-anti-slop: no JS/TS file names among args");
  process.exit(2);
}

function walkUp(start, visit) {
  let dir = start;
  while (true) {
    const found = visit(dir);
    if (found) return found;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function findOxlintCli() {
  return walkUp(SCRIPT_DIR, (dir) => {
    const cli = join(dir, "node_modules", "oxlint", "dist", "cli.js");
    return existsSync(cli) ? cli : undefined;
  });
}

function packageUsesEffect(pkg) {
  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    const bag = pkg[key];
    if (!bag || typeof bag !== "object") continue;
    if (Object.prototype.hasOwnProperty.call(bag, "effect")) return true;
    if (Object.keys(bag).some((name) => name.startsWith("@effect/"))) return true;
  }
  return false;
}

function repoUsesEffect() {
  const starts = [process.cwd(), ...files.map((file) => dirname(file))];
  for (const start of starts) {
    const hit = walkUp(start, (dir) => {
      const pkgPath = join(dir, "package.json");
      if (!existsSync(pkgPath)) return undefined;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        return packageUsesEffect(pkg) ? true : undefined;
      } catch {
        return undefined;
      }
    });
    if (hit) return true;
  }
  return false;
}

const oxlintCli = findOxlintCli();
if (!oxlintCli) {
  console.error("run-anti-slop: oxlint is not available");
  process.exit(2);
}

const pluginEntry = join(SCRIPT_DIR, "..", "vendor", "anti-slop", "src", "index.ts");
const inhumanEntry = join(
  SCRIPT_DIR,
  "..",
  "vendor",
  "oxlint-plugin-inhuman",
  "oxlint",
  "inhuman.plugin.js",
);
if (!existsSync(pluginEntry) || !existsSync(inhumanEntry) || !existsSync(GENERIC_CONFIG)) {
  console.error("run-anti-slop: vendored plugin or vs-owned config is missing");
  process.exit(2);
}

const useEffect = repoUsesEffect();
const config = useEffect ? EFFECT_CONFIG : GENERIC_CONFIG;
if (useEffect && !existsSync(EFFECT_CONFIG)) {
  console.error("run-anti-slop: Effect config is missing");
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    join(SCRIPT_DIR, "load-ts.mjs"),
    oxlintCli,
    "-c",
    config,
    "--disable-nested-config",
    "--deny-warnings",
    ...files,
  ],
  { encoding: "utf8" },
);

if (result.error) {
  console.error("run-anti-slop: cannot start oxlint: " + result.error.message);
  process.exit(2);
}

if (result.status === null) {
  console.error("run-anti-slop: oxlint did not exit");
  process.exit(2);
}

const out = (result.stdout ?? "") + (result.stderr ?? "");
if (out) process.stderr.write(out);

if (/Failed to (?:parse oxlint configuration|load JS plugin)|ERR_UNKNOWN_FILE_EXTENSION|oxlint is not available/i.test(out)) {
  console.error("run-anti-slop: oxlint or the plugin cannot run");
  process.exit(2);
}

if (result.status === 0) process.exit(0);
if (result.status === 1) process.exit(1);

console.error("run-anti-slop: oxlint exited " + result.status);
process.exit(2);
