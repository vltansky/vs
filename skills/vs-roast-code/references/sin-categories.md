# Sin Categories

## Severity Tiers

Fixed taxonomy. Use these exact labels in every roast — consistency builds a shared mental model across sessions. Keep openers and metaphors fresh; keep the tiers stable.

| Tier | Criteria |
|------|----------|
| CAPITAL OFFENSES | Security holes, credential exposure, data loss risk, known-to-crash-in-prod code paths |
| FELONIES | Logic flaws that silently corrupt, architectural violations, `any` epidemics, N+1 queries, callback hell |
| CRIMES | Copy-paste duplication, nested ternaries, magic numbers, swallowed exceptions, dead code |
| MISDEMEANORS | Console logs, TODO fossils, WHAT comments, minor inefficiencies, naming drift |
| PARKING TICKETS | Nitpicks, polish, preferences, "if you're bored" notes |

Findings from the deterministic slop-scan (Pass 0) are tagged `[slop-scan]` inline — their tier is assigned by impact, not by source. A hallucinated import that breaks the build is a CAPITAL OFFENSE; a verbose wrapper is a MISDEMEANOR.

## Common Sins

| Sin | Tier | Roast Angle |
|-----|------|-------------|
| Hardcoded secrets | CAPITAL OFFENSES | Security disaster, gift to hackers |
| SQL injection / unsanitized input | CAPITAL OFFENSES | Open door to production |
| God function (100+ lines) | CAPITAL OFFENSES | Too many responsibilities, identity crisis |
| `any` abuse | FELONIES | Type system betrayal, trust issues |
| Try/catch swallowing | FELONIES | Hiding problems, ostrich behavior |
| Empty catch blocks | FELONIES | Ignoring reality, denial |
| Nested callbacks | FELONIES | Depth metaphors (Dante, Inception, archaeology) |
| N+1 queries | FELONIES | Database restraining order |
| Silent failures | FELONIES | catch-log-continue, optional chaining hiding ops |
| Over-engineering | FELONIES | Rockets for crossing streets |
| Premature abstraction | FELONIES | Fortune telling, solving future problems |
| Copy-paste duplication | CRIMES | DRY violation, clone army |
| Dead code | CRIMES | Ghosts, museums, archaeology |
| 500+ line files | CRIMES | Novel, epic, saga, needs chapters |
| Magic numbers | CRIMES | Mystery, laziness, cryptic messages |
| Nested ternaries | CRIMES | Regex for humans |
| WHAT comments | MISDEMEANORS | Captain obvious energy |
| Console logs left in | MISDEMEANORS | Debugging fossils |
| TODO fossils | MISDEMEANORS | Unfulfilled promises |
| Inconsistent naming | MISDEMEANORS | Identity crisis |
| Trailing whitespace | PARKING TICKETS | Mention if bored |
| Preference-only polish | PARKING TICKETS | Not a crime, just a vibe |
| AI-generated slop | any tier | Tag `[slop-scan]`; assign tier by impact — hallucinated imports = CAPITAL, verbose wrapper = MISDEMEANOR |

## Scan Lenses

Mental sweep before roasting — don't skip domains just because the obvious sins are loud.

- **Correctness** — will this break at runtime? Logic errors, null access, off-by-one?
- **Security** — exposed secrets, injection vectors, unsafe user input, missing auth checks?
- **Performance** — O(n^2) on large data, blocking calls, memory leaks, unbatched operations?
- **Architecture** — god objects, circular deps, wrong abstraction level, mixed concerns?
- **Duplication** — copy-paste that should be shared? Existing utility ignored?
- **Error handling** — swallowed exceptions, missing edge cases, silent failures?
- **AI slop** — comments restating code, try/catch on non-throwing code, defensive nulls on non-null types, wrapper functions adding zero logic?

Not every lens produces a sin. That's fine — the sweep ensures you don't miss the non-obvious ones.
