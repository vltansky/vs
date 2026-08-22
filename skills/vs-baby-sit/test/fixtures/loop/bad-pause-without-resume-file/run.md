LOOP_PAUSE_NO_RESUME_CANARY
done-predicate: merge-ready CI on abc123
paused: yes
started the watcher
watch_pr.py --pr 12 --until merge-ready
ts	phase	decision	why	evidence	result
2026-08-23T00:30:00Z	pause	paused without resume path	missing resume-file	watch_pr.py	paused
