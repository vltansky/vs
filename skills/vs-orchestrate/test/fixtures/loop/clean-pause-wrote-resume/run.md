LOOP_PAUSE_WROTE_RESUME_CANARY
done-predicate: GET /health returns 200
paused: yes
resume-file: /tmp/proj-orch-resume.md
ts	phase	decision	why	evidence	result
2026-08-23T00:30:00Z	pause	wrote resume path	pause exclusive	/tmp/proj-orch-resume.md	paused
