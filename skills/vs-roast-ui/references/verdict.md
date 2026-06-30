# Visual Verdict

Compare a generated UI screenshot against one or more reference images and
return a strict, actionable verdict for the next edit loop.

Adapted from the MIT-licensed `visual-verdict` skill in
Yeachan-Heo/oh-my-claudecode:
https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/skills/visual-verdict/SKILL.md

The copied upstream license notice is included at
[../LICENSE.oh-my-claudecode](../LICENSE.oh-my-claudecode).

## Use When

- The user provides a generated screenshot and a reference image, design mock,
  or expected visual target.
- A `craft`, `live`, `polish`, or `critique` pass needs a clear pass/fail
  fidelity decision.
- The task is about matching layout, spacing, typography, colors, component
  styling, or category conventions.

Do not use this for open-ended taste critique without a reference. Use
`critique` for that.

## Inputs

- **Generated screenshot:** the current UI output.
- **Reference image(s):** one or more target images or mocks.
- **Optional category hint:** dashboard, landing page, settings panel,
  checkout, social feed, docs page, etc.
- **Optional tolerance:** strict / normal / loose. Default to strict for
  implementation tasks and normal for early exploration.

If either generated screenshot or reference image is missing, ask for the
missing artifact. Do not invent a reference from memory.

## Comparison Axes

Score against the reference on:

- layout geometry and relative positioning
- spacing rhythm and density
- typography: family feel, size, weight, line height, tracking
- color and contrast
- component shape, border, elevation, and radius
- content hierarchy and visual priority
- responsive framing when screenshots cover multiple viewport sizes
- category/style match when the reference is an example rather than an exact mock

Use pixel-diff tooling when available as a secondary debugging aid, not as the
sole judgment. Pixel hotspots should become human-readable differences.

## Output Contract

Return JSON only unless the user asks for prose:

```json
{
  "score": 0,
  "verdict": "revise",
  "category_match": false,
  "differences": ["..."],
  "suggestions": ["..."],
  "reasoning": "short explanation"
}
```

Rules:

- `score`: integer from 0 to 100.
- `verdict`: `pass`, `revise`, or `fail`.
- `category_match`: true when the generated screenshot matches the intended
  UI category/style even if details differ.
- `differences`: concrete visual mismatches. Avoid vague taste language.
- `suggestions`: concrete next edits tied to the differences.
- `reasoning`: one or two sentences.

## Thresholds

- **90-100:** `pass`. Only minor polish remains.
- **70-89:** `revise`. The direction is recognizable but still misses visible
  details.
- **0-69:** `fail`. The generated UI does not yet match the reference or
  category.

When `score < 90` during implementation, continue editing and rerun `verdict`
before treating the visual task as complete.

## Integration Notes

- In `craft`, use `verdict` after the first rendered screenshot when there is an
  approved mock or visual probe to compare against.
- In `live`, use it after a variant is accepted if the user is aiming for a
  specific reference.
- In `critique`, use it only when the user supplied a reference; otherwise run
  the normal heuristic and detector critique.
