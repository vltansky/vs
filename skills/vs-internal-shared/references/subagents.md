# Subagent Orchestration

Use subagents when independent context or parallel work materially improves the
result. Delegation has a real context and coordination cost, so direct execution
is the default for small, coupled, or sequential work.

## Budget

Choose the smallest effort level that covers the request. Skills may tighten
these limits for their workflow, but do not loosen them implicitly:

- **Quick:** zero child runs. Execute directly with deterministic tools.
- **Standard (default):** at most one active child and two total child runs.
- **Deep:** at most two active children and four total child runs, still
  dispatched in batches of two.

Use deep only when the user asks for deep or exhaustive work, or the scope has
multiple independent domains that cannot be covered honestly at standard depth.
A model-backed advisor, reviewer, or CLI session counts toward the same child
budget even when it is launched through a shell command instead of the host's
subagent tool.

- Do not delegate work the parent can finish quickly with the context it already
  has, or work that touches the same files as another active child.
- Reuse a completed child with a follow-up only when the task needs its existing
  context. Otherwise prefer a fresh, narrow child.

## Escalation

Collect deterministic evidence before delegating: inspect the scoped diff and
files, search for existing implementations, and run the smallest relevant
test, type, lint, or repository-native analysis command. Delegate only when the
remaining question needs independent judgment, fresh context, or parallel work.

## Context

Give each child fresh context when the host supports it. Pass the objective,
exact scope, relevant file or reference paths, constraints, and expected return
shape. Do not fork the full parent transcript merely for convenience, and do not
paste broad logs or entire plans when a short summary plus paths is sufficient.

In Codex, spawn children with a scoped brief rather than `fork_turns: "all"`;
full-history forks are for genuine continuation threads, not scoped workers. A
long-running parent that forks its whole transcript into every worker multiplies
its own context cost by the worker count.

## Ownership

The parent owns user communication, goal state, integration, and final
verification. Subagents do not create, complete, or block Codex goals. They
return bounded evidence or edits for the parent to inspect.

## Collection

After dispatching, confirm each spawned thread or task ID resolves to a live
child before waiting on it; if the host reports it missing ("No thread found"),
recreate it instead of babysitting a placeholder.

Wait once for the expected completion event after dispatching a batch. Do not
poll `wait_agent` repeatedly while nothing can change; continue useful local
work or use the host's long-wait/notification mechanism. After collection,
verify child claims against the real diff, files, commands, or external state.
A child that completes without evidence or edits counts as failed — re-scope
its brief before re-spawning; do not re-run the same brief.
