CLEAN_QA_NO_VISUAL_CANARY

## QA Report

- Status: PASS
- User path: Open /api/health, type nothing, press enter
- Observable end state: JSON says ok true
- Visual in scope: no
- Evidence:
  - `curl -sf localhost:3000/api/health` - ok
