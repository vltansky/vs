---
name: vs-tune-skill
---

# Tune Skill

<!-- CLEAN_TUNE_SKILL_CANARY -->

Grade exactly one named skill from local chats, then write an improved
copy and a unified diff under a fresh mktemp directory.

## Flow Contract

- **Kind:** Building block
- **Inputs:** target repo and one required skill name
- **Outputs:** inventory, scorecard, scratch diffs
- **Status:** GRADED, NEED_SKILL, or NO_SESSIONS
- **Consumers:** skill authors
- **Skip conditions:** codebase audit or chat hunt

Never grade the whole set. Never upload transcripts. Never mutate real
skills on a default run. Ask whether to apply. Score waste versus the
written contract, and whether a skill fired and was followed.
