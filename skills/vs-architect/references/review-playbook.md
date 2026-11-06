# Architecture review playbook

Use this playbook to vet and present architecture candidates. Use the vocabulary
from `../../vs-pushback/references/architecture-depth-dimension.md`.

## Dependency categories

Classify dependencies before recommending a seam:

1. **In-process** — pure computation or in-memory state. Keep the seam internal
   unless callers genuinely need a stable interface.
2. **Local-substitutable** — a real local stand-in exists, such as an in-memory
   filesystem or embedded database. Test the deep module with that stand-in;
   do not expose the internal seam merely for tests.
3. **Remote-owned** — a separately deployed dependency the project controls.
   The module may own a port, with a production transport adapter and a local
   test adapter.
4. **External** — a third-party dependency. Keep the external contract behind
   an owned seam and use a test adapter or mock only at that seam.

One adapter is a hypothetical seam. Two justified adapters make it real. A
production adapter plus a test adapter counts only when the test adapter enables
behavioral tests that would otherwise be impractical.

## Dependency direction

Within those categories, check volatility: a more-stable module must not import
a more-volatile one. Prefer depending on what changes less (owned seams, domain
types, stable ports) over what changes more (adapters, providers, UI, feature
flags). Flag any import that pulls a stable module toward a volatile one —
nothing imports anything more volatile than itself.

## Co-change evidence

When Evidence claims modules always change together, cite git co-change counts —
do not assert coupling from adjacency alone. Recipe:

```bash
# commits that touched A in the last N months
git log --since='6 months ago' --pretty=format:%H -- path/A
# how often B changed in those same commits
git log --since='6 months ago' --pretty=format:%H -- path/A |
  while read c; do git diff-tree --no-commit-id --name-only -r "$c"; done |
  sort | uniq -c | sort -rn | head
```

Report as `N/M commits that touched A also touched B` (or equivalent). If
history is too thin, say so and lower Confidence.

## Candidate evidence

Require:

- concrete files and lines;
- at least two callers, or a stated reason one critical caller is sufficient;
- the current interface obligations callers must know;
- the current test surface and the behavior it misses;
- the deletion-test result;
- co-change counts when claiming pieces "always change together";
- any applicable ADR decision;
- confidence based on observed code, not aesthetics.

Reject candidates that merely rename, move, wrap, or invert code while leaving
caller obligations unchanged.

## Candidate shape

Use this exact structure for every candidate. Group several file:line problems
under the one deepening that dissolves them — do not list each as its own
candidate when one seam fixes the set.

```markdown
### <N>. <domain-named deepening>

- Strength: Strong | Worth exploring | Speculative
- Dissolves:
  - `path/a.ts:12` — <concrete problem>
  - `path/b.ts:40` — <concrete problem>
- Files/modules: <paths and lines>
- Problem: <caller friction and leaked knowledge; one deepening for the group>
- Evidence: <observed call/test/co-change pattern>
- Suggested deepening: <what behavior moves behind which seam; no interface sketch yet>
- Test surface: <observable behavior through the future interface>
- Locality/leverage: <what concentrates; which callers benefit>
- Deletion test: <where complexity would reappear today>
- Dependencies: in-process | local-substitutable | remote-owned | external
- Dependency direction: ok | stable imports volatile (<where>)
- ADR: aligned | none found | conflicts with <ADR and why reopening may be justified>
- Confidence: High | Medium | Low
```

Keep the problem and suggested deepening in domain language. A source symbol may
appear in `Files/modules` or `Dissolves`, but it should not become the
candidate's conceptual name when the repository already defines the domain term.

## Recommendation strength

- **Strong** — repeated caller pain, clear behavior to hide, existing tests or a
  concrete test surface, and no unresolved ADR conflict.
- **Worth exploring** — credible leverage, but one important caller,
  dependency, or migration fact remains uncertain.
- **Speculative** — plausible shape with incomplete evidence. Include only when
  the uncertainty itself is useful to investigate.

If every candidate is speculative, return `NO_CANDIDATE` and name the evidence
needed to resume instead of dressing uncertainty as a recommendation.

## Test strategy

The interface is the test surface. Recommend behavioral tests through the
deepened module's interface, with adapters only at justified seams. Existing
private-helper tests survive only when they protect an independent invariant;
otherwise replace them after the new behavioral tests pass. Do not stack a new
test layer on every old shallow module by default.
