# Task 3: Docs section

Write the configuration section of the README for this feature. Audience: developers setting it up for the first time.

Raw notes:
- feature is background job retries
- env var `RETRY_MAX_ATTEMPTS`, default 3, integer 0-10. 0 disables retries entirely.
- env var `RETRY_BASE_DELAY_MS`, default 500. delay is exponential: base * 2^attempt, plus up to 20% random jitter.
- env var `RETRY_DEAD_LETTER_URL`, optional, no default. if set, jobs that exhaust all attempts get POSTed there as JSON. if unset they are dropped and only logged at warn level.
- these are read once at boot. changing them requires a restart.
- careful: `RETRY_MAX_ATTEMPTS` above 5 combined with the default base delay means a failing job can occupy a worker for over 4 minutes. we've seen queues back up because of this.
