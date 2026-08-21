# Bounded collaboration

Use this contract when a non-trivial owning workflow can otherwise drift across
research, execution, verification, or coordination without one clear finish
line. It reduces user management; it is not another visible form.

## Infer the work contract

Resolve these fields from the request, repository, and durable artifacts before
broad work:

- **Outcome:** the observable result.
- **Scope boundary:** what is in scope and out of scope.
- **Proof required:** the evidence that earns completion.
- **Durable artifact:** the source of truth when one is useful.
- **Authority granted:** the reads, writes, external actions, and handoffs the
  user already authorized.
- **Reassessment and stop triggers:** the evidence that changes the plan or ends
  the work.

Infer tactical fields. Do not print the contract or ask the user to confirm it
when the evidence already settles the next action. Simple, already-bounded work
does not emit a contract, checkpoint, ledger, artifact, or extra question.

## Facts are the agent's work

Resolve facts and mechanics from code, tools, documents, and the environment.
Ask only when progress requires a strategic choice, access, ownership, or new
authority that evidence cannot supply. Safe read-only and already-authorized
in-scope work continues without a ceremonial approval.

Never turn a missing fact into a preference question. Name the cheapest probe,
run it when authorized, and use its result.

## Reassess on evidence

An evidence event, not elapsed time, triggers reassessment:

- a meaningful phase completes;
- two focused hypotheses fail;
- the same connector, authentication, or authorization boundary fails again;
- scope or authority would expand;
- broad scanning or expensive delegation is proposed;
- the next claimed delivery gate lacks proof.

At the checkpoint, separate verified, blocked, and unknown; update the durable
artifact when one exists; then choose exactly one: continue, narrow, hand off,
park with a resume condition, or stop. Do not ask “should I continue?” when the
safe next step is already authorized.

Emit only a meaningful state change, the next blocker, or a question the user
must answer. An unchanged checkpoint stays silent.

## Keep delivery gates distinct

When a claimed outcome crosses delivery boundaries, track the relevant gates:
code, tests, review, merge, deployment, live behavior, and monitoring or
analytics. Use `proven`, `pending`, `failed`, `blocked`, or `not required`, but
show only gates required by the claimed outcome. Do not display `not required`
rows merely to complete the list.

The detailed ledger belongs in the workflow artifact. Chat names only the
current gate and next blocker. An earlier proven gate never upgrades a later
pending or unknown gate.

## Consumer notes

- **Build:** infer the contract from the approved Goal Contract when one exists;
  do not create a duplicate contract. Phase boundaries are evidence events.
- **Investigation:** reassess before widening the source set, after repeated
  acquisition failure, or when the requested report cannot be proven.
- **Task coordination:** keep each task's outcome and owner; use its current
  delivery gate to classify progress and surface only a real user decision.
- **Verification:** add the relevant-gate ledger only when the claim spans more
  than one delivery boundary. A single bounded check keeps the normal compact
  result.
