# Ops note

To be clear, REDIS_URL is set on all three replicas.
Time will tell whether the canary holds.
Here's the thing: the join needs REDIS_URL first.
It turns out that REDIS_URL was unset on replica 2.
The alert is not only for shard B but also for shard C.
You already know how to set REDIS_URL.
The field is worth naming in the schema.
Analysts note that p99 dropped after the join.
CPU spiked, reflecting the load from the join.

- first item.
- first item.
- first item.

Check redis. Check postgres. Check the queue.
