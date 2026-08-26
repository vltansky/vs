---
name: vs-deslop
---
# Deslop
Then run the on-demand anti-slop file pass on the same in-scope TS/JS files (named files only — not a whole-repo lint, and do not write `oxlint.config` into the consumer repo):

node skills/vs-deslop/scripts/run-anti-slop.mjs <file.ts> [file.ts ...]

That command runs oxlint with the vs-owned config and the vendored generic anti-slop rules. Exit 1 is a catalog fail (not `CLEAN`). If oxlint or the plugin cannot run, report `WARN` or `BLOCKED` — do not pretend `CLEAN`. Enable the Effect rule only when the target repo uses Effect.
PARAGRAPH_PASTE_ANTISLOP_CANARY
9f42cf49e0a4ee9de516dbacbac04e687a0b7ed39e117d23d409555f45e18ef8
