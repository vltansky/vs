# Repository context documents

`CONTEXT.md` is a committed or explicitly user-owned domain glossary. It is
not a session artifact, specification, scratchpad, or implementation log.

## Resolve the relevant context

Before using a domain term in a plan or review:

1. Read the root `CONTEXT-MAP.md` when it exists. It lists the bounded
   contexts, their `CONTEXT.md` files, and relationships between them.
2. For a topic with a clear bounded context, read the relevant `CONTEXT.md`
   glossary. For
   cross-context work, read the relevant mapped glossaries and the map itself.
3. When there is no map, use the root `CONTEXT.md`.
4. If the repository has no context file, check the project's explicit
   per-user context location at `~/.vs/$PROJECT_ID/context/CONTEXT.md` before
   concluding that no glossary exists. Resolve `$PROJECT_ID` from the git
   remote as described in the parent `vs-internal-shared` skill.

If multiple context files could apply and the topic cannot disambiguate them,
ask which context owns the term. Do not silently merge separate glossaries.

## Storage and creation

Existing project preference wins:

- An existing in-repo `CONTEXT.md` or `CONTEXT-MAP.md` is the repository-owned
  source of truth.
- An existing per-user glossary is used when the project has chosen private
  storage.
- If neither exists and a new term is ready to record, ask once where the
  project should keep context docs. Recommend the repository root so the team
  and fresh agents share the language. If the host has project-scoped memory,
  cache that preference by `$PROJECT_ID`; otherwise reuse the path established
  by the user's answer on later runs.

Create files lazily. Reading this guidance never creates a file. Create the
selected `CONTEXT.md` only after the first term is resolved. Create
`CONTEXT-MAP.md` only when the repo genuinely needs multiple bounded contexts.

ADRs follow the same storage preference and the repository's existing ADR
convention. Do not create an ADR directory merely because domain modeling was
loaded.

## Glossary contract

Keep the glossary opinionated and short:

- Define what a project-specific term *is*, in one or two sentences.
- Pick one canonical term. Put synonyms under `_Avoid_` when they would cause
  confusion.
- Group terms under a domain heading when natural clusters emerge.
- Exclude general programming concepts, implementation details, requirements,
  test plans, and unresolved questions.
- Update an existing definition when the user resolves a conflict; never
  silently change the project's language.

The canonical shape is:

```markdown
# <Context name>

<One or two sentences describing this context.>

## Language

**<Term>**:
<Tight definition of what the term is.>
_Avoid_: <synonyms that are not canonical>
```

## Ownership

`vs-shape-it` owns active glossary changes while shaping a design.
`vs-build-it`, `vs-pushback`, and other consumers read the glossary and preserve
its vocabulary; they do not create or update `CONTEXT.md` as a side effect. If
implementation reveals a conflict, record it as an unresolved decision and
route back to shape-it instead of editing the glossary silently.

## ADR gate

Offer or write an ADR only when all three conditions hold:

1. The decision is hard to reverse.
2. It would be surprising without context.
3. It records a real trade-off between alternatives.

The glossary captures language. The ADR captures the durable reason for a
decision. Everything else stays in the conversation or the appropriate spec.
