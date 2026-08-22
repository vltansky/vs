LOOP_TWO_STUCK_STOP_WATCHER_CANARY
done-predicate: merge-ready CI on abc123
stuck-iteration: lint
stuck-iteration: lint
stopped: yes
watch_pr.py --pr 12 --until merge-ready
ts	phase	decision	why	evidence	result
2026-08-23T00:10:00Z	ci	same lint failure after two fixes	no new evidence	check:lint sha:abc123 watch_pr.py	stopped
