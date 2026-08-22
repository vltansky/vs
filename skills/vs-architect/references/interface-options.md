# Interface option comparison

Use this only after the user selects one architecture candidate and explicitly
wants alternative interfaces.

## Frame the problem

State the constraints any interface must satisfy:

- callers and their common path;
- invariants, ordering, error modes, configuration, and performance obligations;
- behavior the implementation should hide;
- dependency category and justified adapters;
- ADR constraints and project domain vocabulary;
- behavioral test surface.

An interface is more than a type signature. Do not present a method list without
its invariants and error modes.

## Design it twice

Produce two or three structurally different options. The parent always owns one
option. Use one focused child run at standard depth only when fresh independent
judgment materially improves the comparison; use up to two active children at
deep effort within the shared budget.

Give each option a distinct pressure:

1. minimize the interface to one to three entry points;
2. make the common caller path trivial;
3. when genuinely needed, preserve extensibility across a remote or external
   seam.

Do not invent a ports-and-adapters option for an in-process dependency merely to
make the options look different.

## Compare

For each option show:

- interface, including invariants and errors;
- one representative caller example;
- behavior hidden in the implementation;
- seam placement and adapters;
- behavioral test surface;
- leverage, locality, and trade-offs.

Recommend one option as the named base. Prefer the smallest interface that
serves observed callers and hides the most repeated knowledge. Never average
two designs into a mush. If a loser has one concrete strength, steal one
concrete bit onto the base and say exactly what moved. Return the comparison to `/vs-shape-it`; do not
implement it.
