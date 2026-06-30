# AGENT-BRIEF issue body format

An issue body is a **brief**, not a task list. The reader (human or agent) must be able to pick it up cold, months later, after the codebase has reorganized, and still understand what needs to ship and how to know when it's shipped.

The brief format optimizes for **durability** over precision. A brief that names a specific function will rot when the function is renamed. A brief that describes observable behavior will still be true after the refactor.

## Section order

1. **Context** — one paragraph, why this exists
2. **Current behavior** — only when a bug, API contract, or config change needs an explicit baseline
3. **Behavioral outcome** — what the system does after this ships
4. **Key interfaces/contracts** — only when durable API, command, schema, event, or config names are load-bearing
5. **Acceptance criteria** — bullet list of checkable outcomes
6. **Out of scope** — explicit bullets of what this does NOT do
7. **Dependencies** — `Blocked by #<n>` lines

`Current behavior` and `Key interfaces/contracts` are optional but useful for bugs and API/config work. Keep them durable: name observable behavior or public contracts, not private helper functions. Do not add optional sections (design notes, implementation hints, risks) unless they're genuinely load-bearing. Side info goes in issue comments or a linked notes file.

## Durability rules

- **No file paths.** `src/features/billing/invoice.ts` will get renamed. Say "the invoice generator" or "billing module" instead.
- **No line numbers.** Same reason, faster rot.
- **No "currently X" anchors** unless the issue includes a `Current behavior` section or links to a doc describing the current state. The target still belongs in **Behavioral outcome**.
- **No private shorthand.** If the issue references a concept, define it inline or link to the glossary (`CONTEXT.md`).
- **No procedural steps.** Don't say "first do X, then Y, then Z". Describe the end state and let the implementer choose the path. Procedural steps pre-commit to an implementation that may no longer be viable.
- **No author-specific voice.** Write in third person / neutral. "The system shall...", not "I want...".

## Phrasing acceptance criteria

Each criterion should be a **checkable statement**. Prefer:

- `When <input>, then <observable output>`
- `Given <precondition>, a <action> produces <result>`
- `The <endpoint/command/UI> returns <shape> when called with <input>`

Anti-patterns (do not use):

- `Implements the design` — not checkable
- `Code is reviewed` — that's a PR workflow, not a feature requirement
- `Tests pass` — of course; describe what the tests *prove*
- `Refactors X` — refactors are means, not ends; describe the end state
- `Handles edge cases` — which edge cases? Name them.

## "Out of scope" is load-bearing

The out-of-scope section is not decorative. It prevents the most common agent failure mode: plausible scope creep ("while I'm here, I should also..."). Every time a reviewer or agent asks "should this slice also do X?", the answer is in this section.

Write out-of-scope aggressively. If the slice doesn't do something obvious-adjacent, say so. Examples:

- `Does NOT change the existing invoice PDF layout`
- `Does NOT backfill historical records`
- `Does NOT add new user-facing copy — uses existing strings only`

## Dependencies

Use GitHub's native syntax:

```
## Dependencies
- Blocked by #42
- Blocked by #43
```

GitHub renders these as a task graph. If the issue has no dependencies, omit the section entirely — don't write "No dependencies".

Do not invent issue numbers. Create dependencies in order (blocking issues first) so numbers exist before dependents reference them.

## Length

A good agent brief is **200–400 words**. Briefs under 100 words are usually missing acceptance criteria. Briefs over 600 words are usually mixing multiple slices or leaking implementation detail.

If your brief is over 600 words, ask: can any section be moved to a linked doc (`CONTEXT.md`, an ADR, a notes file) and referenced instead? Comments on the issue are also fair game — they don't need to survive reorg the way the body does.

## Example (short slice)

```markdown
## Context

Customers currently cannot filter their order history by date range. Support tickets show this is the #1 requested feature for the account dashboard this quarter.

## Behavioral outcome

On the order history page, users can filter the order list by a date range (start and end date). The filter persists in the URL so it survives refresh and is shareable.

## Acceptance criteria

- When a user selects a date range, the order list shows only orders created within that range (inclusive of both endpoints)
- When the date range filter is active, the URL contains query parameters representing the range
- When the page loads with date range query parameters, the list is pre-filtered and the UI reflects the active filter
- When the end date is before the start date, the UI shows an inline validation message and the list does not update
- The filter resets when the user clicks "Clear filters"

## Out of scope

- Does NOT add time-of-day precision (date-only)
- Does NOT add saved filter presets
- Does NOT change the underlying order data model
- Does NOT add filter options beyond date range in this slice

## Dependencies

- Blocked by #118
```
