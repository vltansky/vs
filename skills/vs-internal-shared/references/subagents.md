# Subagent Orchestration

Use subagents when independent context or parallel work materially improves the
result. Delegation has a real context and coordination cost, so direct execution
is the default for small, coupled, or sequential work.

## Budget

- At most two active subagents at a time.
- At most four total child runs in one workflow unless the user explicitly asks
  for a deep or large parallel audit. Deep work still runs in batches of two.
- Do not delegate work the parent can finish quickly with the context it already
  has, or work that touches the same files as another active child.
- Reuse a completed child with a follow-up only when the task needs its existing
  context. Otherwise prefer a fresh, narrow child.

## Context

Give each child fresh context when the host supports it. Pass the objective,
exact scope, relevant file or reference paths, constraints, and expected return
shape. Do not fork the full parent transcript merely for convenience, and do not
paste broad logs or entire plans when a short summary plus paths is sufficient.

## Ownership

The parent owns user communication, goal state, integration, and final
verification. Subagents do not create, complete, or block Codex goals. They
return bounded evidence or edits for the parent to inspect.

## Collection

Wait once for the expected completion event after dispatching a batch. Do not
poll `wait_agent` repeatedly while nothing can change; continue useful local
work or use the host's long-wait/notification mechanism. After collection,
verify child claims against the real diff, files, commands, or external state.
