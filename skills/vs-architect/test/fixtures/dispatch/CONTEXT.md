# Job routing

## Language

**Job**:
A requested unit of background work with a kind and payload.

**Dispatch**:
The complete act of validating a Job, selecting its queue, and enqueueing it.
_Avoid_: submit pipeline, task handoff.
