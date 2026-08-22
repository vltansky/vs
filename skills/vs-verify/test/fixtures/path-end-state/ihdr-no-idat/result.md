IHDR_NO_IDAT_VERIFY_CANARY

## Verification Result

- Status: PASS
- User path: Open Settings, tap Profile, type a name, tap Save
- Observable end state: Profile shows the new name
- Visual in scope: yes
- Visual baseline: shot.png
- Evidence:
  - `npm test -- profile` - 3 passed
