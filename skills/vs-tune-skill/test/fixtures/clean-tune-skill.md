---
name: vs-tune-skill
---

# Tune Skill

<!-- CLEAN_TUNE_SKILL_CANARY -->

Grade a repo's installed skills from local chats, then write improved copies
and unified diffs under a fresh mktemp directory.

## Flow Contract

- **Kind:** Building block
- **Inputs:** target repo and local sessions
- **Outputs:** inventory, scorecard, scratch diffs
- **Status:** GRADED or NO_SESSIONS
- **Consumers:** skill authors
- **Skip conditions:** codebase audit or chat hunt

Never upload transcripts. Never mutate real skills on a default run. Ask
whether to apply. Score waste versus the written contract, and whether a
skill fired and was followed.
