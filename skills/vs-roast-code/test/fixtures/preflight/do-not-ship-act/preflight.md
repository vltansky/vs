DO_NOT_SHIP_PREFLIGHT_CANARY

Healthy point: main @ abcdef1234567
git rev-parse main
git diff main...HEAD
Non-empty three-dot.

### Act
- **[SQL injection]** — src/db.ts:9
```
const q = `SELECT * FROM users WHERE id = ${id}`
```

DO NOT SHIP
