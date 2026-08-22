LOOP_TWO_THEN_CONTINUE_CANARY
done-predicate: merge-ready CI on abc123
stuck-iteration: lint
stuck-iteration: lint
continued: yes
started the watcher again
watch_pr.py --pr 12 --until merge-ready
ts	phase	decision	why	evidence	result
2026-08-23T00:15:00Z	ci	same lint twice then watch again	no new evidence	check:lint sha:abc123	continued
