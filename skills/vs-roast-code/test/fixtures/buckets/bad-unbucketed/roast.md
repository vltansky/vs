UNBUCKETED_ROAST_CANARY

1. **[Hardcoded secret]** — config.ts:12 rotate the key
2. **[SQL injection]** — db.ts:9 parameterize the query
3. **[console.log]** — app.ts:3 drop the leftover log
