# Task 2: CLI error messages

Write the user-facing error message text for these three CLI failure conditions. Audience: developers using the CLI, who may be new to it.

Condition 1: user ran `deploy push` but there is no `deploy.config.json` in the current directory or any parent directory. The fix is to run `deploy init`, or to pass `--config <path>`.

Condition 2: the auth token in `~/.deploy/credentials` expired 6 days ago. Refresh is `deploy login`. Tokens last 30 days. Nothing was uploaded, so nothing needs cleanup.

Condition 3: the target environment "prod" exists but the user's role (developer) cannot deploy to it. Only the "release" role can. Getting that role goes through the team admin. This is not a bug and retrying will not help.
