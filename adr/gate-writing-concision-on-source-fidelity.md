# Gate writing concision on source fidelity

Date: 2026-08-06

## Context

`vs-write` tells the model to keep the substance and cut without flattening. It
does not tell the model what to do when those two instructions disagree. Until
now that gap cost nothing, because `vs-write` carried no concision rules sharp
enough to create the conflict — and no tests of any kind.

A paired blind test made the conflict measurable. Twelve fresh agents wrote six
pieces (PR description, CLI error strings, README configuration section,
incident summary, concept explainer, release announcement) from identical
briefs. Half followed the current `vs-write`; half followed a distilled Strunk
*Elements of Style* skill — active voice, omit needless words, positive form,
emphatic word at the end of the sentence. Blind judges scored each draft on
fidelity, order, force, slop-resistance, and genre fit, 0-5 per dimension.

Totals were near-identical (119 vs 123 of 150). The dimensions were not:

| Dimension | vs-write | Strunk | Delta |
|---|---|---|---|
| Fidelity | 26/30 | 19/30 | **-7** |
| Order | 23/30 | 27/30 | +4 |
| Force | 21/30 | 27/30 | +6 |
| Slop-resistance | 24/30 | 25/30 | +1 |
| Genre fit | 25/30 | 25/30 | 0 |

Every fidelity loss in the Strunk drafts was a *tightening* invention — the
model manufactured a fact so a sentence could land harder. Verbatim, against
briefs that said no such thing:

- brief: "we think that's wrong but fixing it is out of scope" -> draft: "We
  think it should fail open instead"
- brief: gives only the retry formula -> draft: "set `RETRY_DEAD_LETTER_URL` so
  exhausted jobs stop retrying sooner" (mechanically false; dead-lettering fires
  after attempts are exhausted)
- brief: "contributing factor" -> draft: "**Cause:**"

The current skill invents too, but less, and its inventions are padding rather
than load-bearing claims ("regardless of selection size"). Its own weakest
dimension is force, and the judges' criticisms there were structural, not
sentence-level: seven H2 sections for a change that fits on one screen,
decorative bold run-in labels, a sentence restating the heading directly above
it, a textbook explanation of sliding windows delivered to the team that owns
the rate limiter.

`vs-write` is a building block for `vs-ship-it` PR bodies, `vs-brief`, and
`vs-octocode`. A rule that trades a preserved qualification for a
sharper sentence does not stay in one document.

## Decision

In `vs-write`, concision is subordinate to fidelity, and the subordination is
enforced by a test rather than by prose alone.

- **Concision may not buy a fact.** Do not add a cause, a severity word, a
  guarantee, a recommendation, a commitment, or a mechanism to make a sentence
  land. When the source states a problem without stating the remedy, the copy
  states the problem without the remedy. Promoting a hedge to a claim, a
  contributing factor to a cause, or "degraded" to "outage" is a fidelity
  failure regardless of how much better the sentence reads.
- **Fidelity is a gate, not a weighted score.** In `skills/vs-write/test/`, the
  fact-survival and no-invention checks are pass/fail. A change that improves
  force or order while regressing either check fails, and the score it earned
  elsewhere does not offset it.
- **The eval's invention canaries stay out of `SKILL.md`.** The skill states the
  general rule; the test checks specific inventions the skill never names. A
  canary quoted in the instructions measures compliance with the instructions,
  not fidelity.
- **A held-out slice never informs iteration.** Two of the six cases are run
  only at the final gate, so rules cannot be patched toward the cases being
  watched.
- **Force is measured on structure, not by a judge.** Word budget, section
  count, bold run-in labels, and heading-restatement are regex-checkable and are
  where the measured deficit actually is. Only reader-first ordering and genre
  fit are judged, binary, with reasoning before verdict.

The rule is `vs-write`'s. `vs-deslop` governs the equivalent tradeoff in code
and is unchanged.

## Consequences

- `vs-write` gains its first tests. The fidelity gate is worth having even if no
  concision rule is ever imported, which is why it lands before the merge.
- Some copy stays longer than a pure concision rule would leave it. Accepted: a
  preserved "we have not confirmed either way" is worth more to a postmortem
  reader than the words it costs.
- Every future edit to `vs-write` inherits a non-regressing fidelity check.
  Sharpening the style rules is cheap; sharpening them at fidelity's expense is
  now visible.
- Risk: the anchor-token checks reward transcription of exact strings and could
  push copy toward quoting the brief. Mitigated by keeping anchors to facts that
  carry meaning — numbers, hedges, warnings, links — and never to phrasing.
- Risk: two judged criteria on a stochastic generator are noisy at n=1.
  Mitigated by running two trials at each gate and by giving the deterministic
  checks 8 of the 11 weight.

## Alternatives considered

- **Adopt the Strunk skill's rules wholesale.** Rejected on the measurement: it
  costs 7 fidelity points to buy 6 force points and 4 order points, and the
  fidelity losses are fabricated claims in reviewer-facing and customer-facing
  documents.
- **Keep the two skills separate and let the user pick.** Rejected. The two
  disagree about what to do with an unstated remedy, and a user choosing between
  them at request time cannot know which conflict they are about to hit.
- **Import Strunk's rules but rank fidelity higher in prose only, with no test.**
  Rejected. `vs-write` already ranked substance above cutting in prose and the
  blind test still produced three load-bearing fabrications; unenforced
  precedence is what failed.
- **Vendor the four *Elements of Style* section files as progressive-disclosure
  references.** Rejected. The measured gain sits in four composition rules that
  fit in a section, the corpus is roughly 12k tokens of a shipped plugin, and
  its 1918 usage chapter carries advice this skill would have to contradict.
- **Adopt the Strunk skill's "AI writing patterns to avoid" list.** Mostly
  rejected: slop-resistance was the one dimension where the two skills tied
  (24 vs 25), so the list is largely redundant with the existing avoid-list.
  Only the terms absent from that list are folded in.
