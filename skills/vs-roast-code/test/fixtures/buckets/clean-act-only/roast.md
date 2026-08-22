CLEAN_ACT_ONLY_CANARY

### Act
- **[Hardcoded secret]** — config.ts:12 must rotate; owner is the PR author
- **[SQL injection]** — db.ts:9 parameterize the unsanitized query
