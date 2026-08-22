# Clean eval skill

Write `scripts/reject-mention-only.mjs` that scores fixture file content.
Exit 0 clean, exit 1 reject, exit 2 cannot check. Treat 2 as not a pass.

Live cases use PathGrade `createAgent` plus `evaluate`. Static asserts
wording or runs the workspace scorer on fixtures.

Gold is the required artifact the scorer checks. Fail-closed: missing
evidence is a fail. Isolation: `createAgent({ skillDir, workspace })`
scores an isolated workspace, not the checkout.

Name the required behavior. Pair copied slogans with `not.toMatch`.
Add the exclusive alternative a slogan-only skill fails.

Keep fixture canaries out of this file.
