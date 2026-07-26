# Agent-owned preview lifecycle

Shared by `vs-qa`, `vs-build-it`, and `vs-ship-it`. It defines how an agent
reaches a running surface when evidence requires one.

An **ephemeral preview** is an agent-owned, port-scoped, phase-scoped process
started to capture evidence. It is not an interactive dev server handed to a
human, and it is not left running by accident.

## Resolution order

1. **Deployed preview.** A PR preview, staging URL, or existing deployment that
   is already reachable. Prefer it — nothing to start, nothing to clean up.
2. **Already-running local surface serving this worktree.** Probe this
   worktree's port before starting anything and reclaim a surface left by an
   interrupted earlier run rather than silently binding a second one. A listener
   started from a different worktree serves different code; attaching to it
   captures evidence for the wrong branch. Confirm ownership before reusing.
3. **Ephemeral preview.** Start the project's own dev or preview command on a
   port scoped to this worktree.
4. **Blocker.** Report the exact missing prerequisite. "No browser path" is not
   an acceptable outcome on its own — name what was missing.

## One preview per worktree

Worktrees share a repository but not a checkout, so two runs in two worktrees
are two different codebases and need two different previews. A fixed default
port binds the first worktree and collides with every other one.

**Prefer the project's own per-worktree mechanism.** Look for it before deriving
anything: a worktree- or branch-aware script, a compose or devcontainer file
that maps its own port, a `PORT` convention in `.envrc` or `CLAUDE.md`, or a
workspace runner that assigns a port per project. When the project already
solved this, use its command and record which mechanism was used.

**Otherwise derive the port from the worktree path** so the same worktree
resolves to the same port across runs and different worktrees never share one:

```bash
PREVIEW_PORT=${PREVIEW_PORT:-$(( 4300 + $(git rev-parse --show-toplevel | cksum | cut -d' ' -f1) % 200 ))}
while lsof -iTCP:"$PREVIEW_PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PREVIEW_PORT=$(( PREVIEW_PORT + 1 ))
done
```

Stability is what makes reclaiming safe: a listener on this worktree's derived
port is this worktree's own. Before reusing one, confirm its working directory
matches — `lsof -a -p "$(lsof -t -iTCP:"$PREVIEW_PORT" -sTCP:LISTEN)" -d cwd`.
When it does not match, or the check is unavailable on the host, walk to the
next free port and start a fresh preview rather than assuming ownership.

## Starting one

Read the command from the project's `package.json` scripts, Makefile, or
equivalent. Do not invent one. Bind the resolved port explicitly so the
lifecycle is recoverable, start it detached, and wait for it to answer before
capturing.

```bash
PREVIEW_LOG=$(mktemp -t vs-preview.XXXXXX)
<project preview command> --port "$PREVIEW_PORT" >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 30); do
  curl -sf "http://localhost:$PREVIEW_PORT" >/dev/null && break
  sleep 1
done
```

If it never answers, stop it, read `$PREVIEW_LOG`, and report the startup
failure as the blocker. Do not proceed as if the surface exists.

## Recording it

Every started process is recorded in the run log and in the handoff, with:

- the exact command
- the PID
- the port and URL
- the worktree it serves
- the stop command

Without these the user cannot reproduce the capture or clean up after an
interrupted run.

## Stopping it

Whoever starts a preview owns its lifetime.

- **`vs-qa` and `vs-build-it`** stop every process they start. Build-it stops
  previews in Phase 6 (cleanup), alongside debug instrumentation removal.
- **`vs-ship-it`** is the deliberate exception: when no deployed preview exists,
  it starts a preview *for the human* and leaves it running, then states the URL,
  the route, any fixture or login needed, and the exact stop command.

```bash
kill "$PREVIEW_PID" 2>/dev/null
```

Verify the port is free afterwards. A run that cannot stop its own process says
so and gives the user the `kill` command.

## Safety

The preview runs the project's own code with the project's own configuration.
Do not point it at production data or production credentials to capture
evidence. If the only way to reach the named surface is a production
credential, that is a blocker to report, not a step to take.
