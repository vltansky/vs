# Architecture Depth dimension

Run this dimension when a plan proposes architecture, refactoring, module boundaries, abstraction, dependency inversion, or a new interface.

## Vocabulary

- **Module** — a cohesive unit with a clear responsibility.
- **Interface** — the public contract other code depends on.
- **Seam** — the boundary where behavior can be substituted, tested, or isolated.
- **Depth** — a small interface hiding meaningful complexity.
- **Leverage** — many callers benefit from one well-placed improvement.
- **Locality** — related decisions and state live together, not scattered across callers.
- **Adapter** — code that translates between an owned interface and an external or unstable contract.
- **Deletion test** — what becomes simpler or removable if this boundary exists?

## Questions to force

1. Which caller pain does this boundary remove?
2. Is the proposed module deep, or just a renamed folder with the same complexity leaking through?
3. What is the smallest public interface that still hides the complexity?
4. Which dependencies are owned, local-substitutable, remote-owned, or truly external?
5. What is the test surface: through the public interface, an adapter seam, or an end-to-end flow?
6. What would become easier to delete if this design is right?

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
