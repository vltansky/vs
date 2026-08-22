EMPTY_JSON_BASELINE_VERIFY_CANARY

## Verification Result

- Status: PASS
- User path: Open Settings, tap Profile, type a name, tap Save
- Observable end state: Profile shows the new name
- Visual in scope: yes
- Visual baseline: empty.json
- Evidence:
  - `npm test -- profile` - 3 passed
