# Third-Party Notices

This plugin includes or adapts material from the following third-party projects.

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
- Used in: `skills/vs-prototype`, `skills/vs-write`
- Sources:
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
