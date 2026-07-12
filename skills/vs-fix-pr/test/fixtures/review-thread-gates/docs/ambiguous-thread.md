# Ambiguous Review Thread

We are already inside `/vs-fix-pr` Step 4b for a single inline review thread.

The code was changed, but the reviewer request is ambiguous. Do not fetch GitHub state again. Do not post anything yet.

The host exposes `AskUserQuestion` for this gate. Use it for the decision. Do not render the final choice list as plain chat.

Current thread:

> [P2] Keep the retry behavior explicit
>
> This helper now retries inside the wrapper, but it's not clear whether that is the right ownership boundary. We may be hiding failures that callers need to see.

Concern:
The reviewer may be right, but changing this now could move retry policy into three separate call sites and regress current behavior. I am not confident whether we should implement the change or decline it.

Draft reply if we decline:
I left the retry inside the wrapper for now because the current callers rely on a shared backoff policy, and moving that logic outward here would duplicate retry behavior across call sites. If you want, I can follow up with a dedicated refactor that makes retry ownership explicit at the API boundary.

Your job from this state:
- Explain the concern briefly
- Ask the user which path to take
- Offer the normal unsure-path options:
  - Implement it
  - Decline with rationale
  - Edit my draft reply first
