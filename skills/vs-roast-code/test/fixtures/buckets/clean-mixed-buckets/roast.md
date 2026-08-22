CLEAN_MIXED_BUCKETS_CANARY

### Act
- **[Hardcoded secret]** — config.ts:12 must rotate; owner is the PR author

### Consider
- **[Extract helper]** — parse.ts:40 judgment call; do not block merge

### Noted
- file is 180 lines — parse.ts:1 recorded, no action

### Dismissed
- rename getUser — api.ts:7 missing context; the name already matches the public API
