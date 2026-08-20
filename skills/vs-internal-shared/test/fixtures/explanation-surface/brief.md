# Deployment explanation brief

Explain how a release moves through these owners and gates:

- Build worker creates an immutable artifact.
- CI verifies tests and records the artifact identity.
- Release operator approves production rollout.
- Deployment service serves the approved artifact.
- Live verification compares the served identity and user behavior.

The user needs to understand that green CI does not prove deployment or live
behavior. They must decide whether to approve rollout after CI passes.
