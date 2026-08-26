# Third-Party Notices

This plugin includes or adapts material from the following third-party projects.

## Oren Roth's PR Walkthrough skill

- Author: Oren Roth
- Used in: `skills/vs-pr-walkthrough`

The `vs-pr-walkthrough` skill is based on Oren Roth's original idea, workflow,
renderer feature set, and GitHub-native review UI for turning an alphabetical
PR file dump into a logical, step-by-step story. VS preserves the original CLI,
optional diff fetching, rich narrative allowlist, per-file notes, configurable
folding, path shortening, labels, syntax highlighting, and viewed interactions.
Its adaptations are exact-head state, fail-closed file mapping, exact-path note
matching, disk-backed evidence, and a dependency-free Node implementation.

## OpenAI GitHub Actions CI Fix skill

- Project: https://github.com/openai/plugins
- Used in: `skills/vs-baby-sit`
- Source: `github/skills/gh-fix-ci/scripts/inspect_pr_checks.py`
- License: Apache-2.0

The `vs-baby-sit` CI inspector adapts OpenAI's check-field compatibility,
GitHub Actions run/job log fallback, external-provider classification, and
focused failure-snippet extraction. The implementation was modified for the vs
autonomous PR-watch loop and stable JSON output. The copied Apache-2.0 license
text is included at `skills/vs-baby-sit/LICENSE.openai-gh-fix-ci`.

## Ponytail

- Author: Dietrich Gebert
- Project: https://github.com/dietrichgebert/ponytail
- Used in:
  - `skills/vs-ponytail`
  - `hooks/ponytail.mjs` and `hooks/hooks.json`
  - composition in `skills/vs-shape-it`, `skills/vs-pushback`,
    `skills/vs-build-it`, and `skills/vs-roast-code`
  - `skills/vs-build-it/test/baselines/ponytail-full.md`
- Source: https://github.com/dietrichgebert/ponytail/tree/2ed6c52c9d7e5e56942508591085fd45dea277d3
- License: MIT

The `vs-ponytail` minimum-solution ladder, session/subagent hook delivery, and
workflow composition are adapted from Ponytail. vs rewrites the guidance to
preserve requirements, security, accessibility, research, evidence, and
verification. The unmodified `ponytail-full.md` copy is retained as the frozen
pure-Ponytail arm of the PathGrade comparison. The copied MIT license text is
included at `skills/vs-build-it/test/baselines/LICENSE.ponytail`.

## anti-slop

- Author: Dillon Mulroy
- Project: https://github.com/dmmulroy/anti-slop
- Used in: `skills/vs-deslop` on-demand named-file Oxlint pass
- Source: https://github.com/dmmulroy/anti-slop/tree/6d538555cb151d4121ed51a27db81890eacf8ae9
- License: MIT

The `vs-deslop` skill vendors the generic anti-slop Oxlint plugin (`src/`)
and runs it on named in-scope TS/JS files only. Nothing is installed into
the consumer repository. The Effect rule group is opt-in when the target
repo depends on Effect. The copied MIT license text is included at
`skills/vs-deslop/LICENSE.anti-slop`.

## oxlint-plugin-inhuman

- Author: pyronaur
- Project: https://github.com/pyronaur/oxlint-plugin-inhuman
- Used in: `skills/vs-deslop` on-demand named-file Oxlint pass
- Source: https://github.com/pyronaur/oxlint-plugin-inhuman/tree/aedf29b8e01b2548e9cd589e836b6b326136040a
- License: MIT

The `vs-deslop` skill vendors `inhuman/no-empty-wrappers` and
`inhuman/no-swallowed-catch` from that pinned commit and runs them on
named in-scope TS/JS files only. Nothing is installed into the consumer
repository. The copied MIT license text is included at
`skills/vs-deslop/LICENSE.oxlint-plugin-inhuman`.

## GOV.UK style agent skill

- Author: fofr
- Used in: `skills/vs-write`
- Source: https://gist.github.com/fofr/505e225f9bf5e839d30c12ba6bfa0be2

The `vs-write` skill is an original rewrite inspired by the source skill's use of
GOV.UK content-design principles: reader needs, front-loaded structure, plain
language, active voice, and accessible formatting. No source text is reproduced
verbatim.

## Matt Pocock's skills

- Project: https://github.com/mattpocock/skills
- Used in: `skills/vs-tldr`, `skills/vs-prototype`, `skills/vs-write`
- Sources:
  - https://github.com/mattpocock/skills/blob/0986ebaf5d29e812162702b2633a2942c30200d2/docs/productivity/wait-what.md
  - https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype
  - https://github.com/mattpocock/skills/blob/main/skills/in-progress/writing-shape/SKILL.md
- License: MIT

The `vs-prototype` question-first contract and UI/logic prototype branches adapt
Matt Pocock's prototype skill. The implementation is rewritten for the vs flow,
repository safeguards, and decision-artifact conventions. The MIT license text
is included at `skills/vs-prototype/LICENSE.mattpocock-skills`.

The `vs-write` source-grounding and long-form shaping guidance adapts Matt
Pocock's `writing-shape` skill. It keeps routine rewrites direct while applying
the source skill's model for grounding concepts, ordering blocks, preserving
raw material, and naming gaps.

The `vs-tldr` explanation-compression contract adapts the referenced `wait-what`
skill: it re-pitches the explanation that ran too long, restores the missing
premise, and keeps the repair explicit-only. The implementation is rewritten
for the vs routing, output-style, and cross-host contracts. The MIT license text
is included at `skills/vs-tldr/LICENSE.mattpocock-skills`.

## The Elements of Style

- Author: William Strunk Jr.
- Used in: `skills/vs-write`
- Source: _The Elements of Style_ (1918), public domain
- Via: a `vs-write-clearly` skill that restated Strunk's rules for agent use

The `vs-write` composition and usage guidance distills Strunk's elementary
principles — put the emphatic word last, keep related words together, make the
paragraph the unit of composition, prefer the definite and concrete, omit
needless words — into the skill's existing principles, style, and structure
sections. The rules are restated in this skill's own terms and applied to the
artifacts vs writes; the source text is not reproduced and no reference corpus
is vendored. Strunk's rules assume a trusted author writing their own claims, so
`vs-write` subordinates them to its source-fidelity guardrails. See
`adr/gate-writing-concision-on-source-fidelity.md`.

## Impeccable

- Project: https://github.com/pbakaus/impeccable
- Used in: `skills/vs-roast-ui`
- Source: https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md
- License: Apache-2.0

The `vs-roast-ui` skill copies and adapts Paul Bakaus' Impeccable skill tree,
including its references, scripts, and nested helper agents. The copied
Apache-2.0 license text is included at
`skills/vs-roast-ui/LICENSE.impeccable`.

## oh-my-claudecode

- Project: https://github.com/Yeachan-Heo/oh-my-claudecode
- Used in: `skills/vs-roast-ui/reference/verdict.md`
- Source: https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/skills/visual-verdict/SKILL.md
- License: MIT

The `vs-roast-ui` `verdict` command adapts Yeachan Heo's `visual-verdict` skill.
The copied MIT license notice is included at
`skills/vs-roast-ui/LICENSE.oh-my-claudecode`.

## Warp skill-doctor

- Project: https://github.com/warpdotdev/common-skills
- Used in: `skills/vs-tune-skill`
- Source: `.agents/skills/skill-doctor` (inspiration only)

The `vs-tune-skill` skill is an original rewrite inspired by Warp's
local-transcript grading idea: collect recent sessions, score them, draft
skill diffs in scratch, and render one review page. No Warp skill text,
scripts, HTML, report chrome, or factories CTA is vendored.
