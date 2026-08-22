LOOP_PREDICATE_FIRST_CANARY
done-predicate: GET /health returns 200 on the staging URL
ts	phase	decision	why	evidence	result
2026-08-23T00:00:00Z	seed	wrote M1 evidence predicate	need an exit check before delegate	GOALS.md#M1	predicate-written
2026-08-23T00:01:00Z	delegate	delegated /vs-build-it	predicate is on disk	GOALS.md#M1	building
