# Architecture Depth dimension

Run this dimension when a plan proposes architecture, refactoring, module boundaries, abstraction, dependency inversion, or a new interface.

## Vocabulary

- **Module** — anything with an interface and an implementation: a function,
  class, package, or tier-spanning slice.
- **Interface** — everything a caller must know to use the module correctly,
  including types, invariants, ordering, error modes, configuration, and
  performance characteristics.
- **Implementation** — the code inside a module.
- **Seam** — where an interface lives; a place behavior can be changed without
  editing in place.
- **Depth** — leverage at the interface. A deep module hides substantial
  behavior behind a small interface; a shallow module's interface is nearly as
  complex as its implementation.
- **Adapter** — a concrete thing that satisfies an interface at a seam.
- **Leverage** — what callers gain from depth: more behavior per unit of
  interface they must learn.
- **Locality** — what maintainers gain from depth: change, bugs, knowledge, and
  verification concentrate in one place.
- **Deletion test** — imagine deleting the module. If complexity vanishes, it
  was not hiding anything. If complexity reappears across callers, it was
  earning its keep.

## Principles

- Depth is a property of the interface, not implementation size.
- The interface is the test surface.
- One adapter is a hypothetical seam; two justified adapters make it real.
- A deep module may keep internal seams for its own tests without exposing them
  through its external interface.

## Questions to force

1. Which caller pain does this boundary remove?
2. Is the proposed module deep, or just a renamed folder with the same complexity leaking through?
3. What is the smallest public interface that still hides the complexity?
4. Which dependencies are in-process, local-substitutable, remote-owned, or truly external?
5. What is the test surface: through the public interface, an adapter seam, or an end-to-end flow?
6. Where would complexity reappear if the current module were deleted?

## Anti-patterns

- Extracting a helper or service without reducing caller complexity.
- Adding an interface only because there are two implementations in the plan, not because callers need a stable contract.
- Testing private helpers while the real caller path remains unguarded.
- Moving code across files while preserving the same coupling.
- Introducing a boundary that makes deletion harder.

## Output shape

For architecture findings, include:

- Files or modules involved
- Problem
- Suggested deepening
- Test surface
- Why this improves locality or leverage
- Deletion-test question
