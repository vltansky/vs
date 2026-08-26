import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !url.split("?")[0].endsWith(".ts")) {
    return nextLoad(url, context);
  }
  const source = readFileSync(fileURLToPath(url), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileURLToPath(url),
  });
  return {
    format: "module",
    source: result.outputText,
    shortCircuit: true,
  };
}
