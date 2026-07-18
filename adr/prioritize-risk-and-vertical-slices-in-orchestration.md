# Prioritize delivery risk and vertical slices in orchestration

- Date: 2026-07-19
- Supersedes: `coordinate-long-running-work-with-vs-orchestrate.md` where it
  requires a fresh audit, review, and verification gate after every milestone

## Context

A marketing analytics build exposed a failure in the workflow's incentives. A
small deployable tracking slice expanded into a multi-provider analytics and
experimentation platform. Execution completed contract and backend milestones
before connecting the frontend, while repeated inventory, review, verification,
and worker-recovery ceremonies consumed most of the run. The result contained
substantial durable infrastructure but did not push or deploy the requested
observable behavior.

Dependency-first planning and mandatory full gates made internal foundations
look like progress even when user-provided access and the real production seam
remained unresolved.

## Decision

Shape-it, build-it, and orchestrate order delivery by:

1. user help or external access required for proof;
2. the cheapest test of a plan-invalidating assumption;
3. the smallest deployable end-to-end slice;
4. deeper reliability, scale, and optional capabilities.

Risk-first means retiring uncertainty, not implementing the largest defensive
subsystem first. A multi-capability spec does not require orchestration when its
smallest valuable slice fits one build-it run.

The first slice must advance the approved outcome beyond the confirmed baseline.
Re-auditing known working behavior remains evidence unless the goal is to repair
that behavior. Missing access for new value is surfaced to the user instead of
being replaced with easier, lower-value work.

Orchestrate audits milestone state before advancing, but full independent
review and verification are proportional. They run at risky integration,
irreversible data, security, external mutation, deployment, or final acceptance
boundaries. Several low-risk internal milestones may share one integration
gate. Every milestone still requires its stated evidence.

## Consequences

- Positive: missing access and user decisions surface before broad internal work
- Positive: the first accepted result is observable end to end
- Positive: optional platforms and reliability depth cannot silently enlarge the
  first delivery
- Positive: review cost follows risk instead of artifact count
- Negative: planners must distinguish delivery risk from architectural depth
- Negative: low-risk milestones may wait for a shared integration review

## Alternatives considered

- Keep dependency-first sequencing: rejected because it delays proof behind
  internal layers.
- Review and verify every milestone independently: rejected because it treats
  contract documents and production mutations as equally risky.
- Skip milestone evidence entirely: rejected because proportional gates still
  require explicit evidence before completion.
