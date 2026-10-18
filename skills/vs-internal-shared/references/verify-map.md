# Verify map

A project-local cold-read so `/vs-verify` and `/vs-qa` launch, doctor, and drive
the app instead of guessing. Generate a **map**, not a skill. Write it into the
**target project** at `.vs/verify-map/`. Do not write it into vs skills and do
not write it into `~/.vs/` session artifacts.

The map is for the next agent that has never seen the app. No placeholders.
Ask the user only what the checkout cannot answer.

## When to generate

If `.vs/verify-map/` is missing, generate it once from this file. If a map
exists, consume it. If a map is stale, run the [maintain pass](#maintain-pass).
Do not silently overwrite the map. Do not grow a factory inside `vs-verify` or
`vs-qa`.

## Interview the repo

Answer these from the codebase:

- **Surface:** what a user actually touches (web UI, CLI/TUI, desktop, API,
  mobile, library). Pick the primary surface and note the rest.
- **Run:** how the app starts locally. Prefer the repo's own documented command
  (package scripts, Makefile, README). Note ports, env, seed data, auth.
- **Drive:** how an agent interacts. Existing harness first (Playwright,
  Cypress, expect scripts, PTY helpers, curl, debug port). Generic browser/CDP,
  tmux/PTY, or plain HTTP only after that. Stable handles (ARIA, data
  attributes, prompt strings, routes) — not coordinates.
- **Observe:** what evidence can be captured (screenshots, transcripts, bodies,
  logs, exit codes, DB state).
- **Isolate:** can two instances run side by side (ports, data dirs, profiles)?
  If not, say so: refusing to double-drive a shared instance beats corrupting
  the user's session.

If the checkout does not start, fix that (or report it) before writing the map.

## Required map sections

Write these into `.vs/verify-map/README.md`, grounded in the interview:

- **Launch:** start command, ready signal, teardown. For a short-lived CLI,
  launch is build-once then start each drive in its own isolated session.
- **Doctor:** one read-only check: is this instance worth driving? Process up,
  right build, port owned by us, auth valid.
- **Drive:** the harness recipe with real selectors and commands from this repo.
- **Evidence:** user path plus action and resulting state plus side effects.
  Proof lives where the map names it and **survives cleanup**.
- **Cleanup / teardown:** stop what this run started, never by process name.
  Scratch state goes; evidence stays.
- **Isolate:** the note from the interview.

## Feature map

`.vs/verify-map/features/README.md` plus one file per feature. Seed **3-5**
files. Each file answers:

- what it is
- how to get there (user POV)
- how to drive it (harness, stable handles)
- gotchas

## Live-drive gate

The map is a draft until one mapped feature was actually launched, doctored,
driven, evidenced, and cleaned up, and the evidence still exists after cleanup.
That live-drive-before-count rule is the handover gate. Record it in
`.vs/verify-map/LIVE_DRIVE.md`: the feature name and the surviving evidence
path. A map that was never live-driven does not count.

## Maintain pass

Use this pass to repair a stale map from evidence. Run it when one of these
conditions is true:

- A mapped step fails during `/vs-verify` or `/vs-qa`.
- The user asks to refresh the map.
- The diff changes a route, ARIA name, data attribute, prompt string, or
  command that a feature file names.

### 1. Read the source

Start one source reader for each feature file. Run the readers in parallel.
Each reader compares "how to get there" and "how to drive it" with the current
code: routes, ARIA names, data attributes, prompt strings, and commands. Each
reader reports one of two results:

- **no drift:** each step agrees with the code.
- **drift:** the file name, the stale step, the current value in the code, and
  the source path that proves it.

Also compare Launch, Doctor, and Cleanup in `README.md` with the current
scripts. The readers do not edit files.

### 2. Drive the changed features

If no reader reports drift, skip this step. Otherwise, do one live pass.
Launch, doctor, drive, evidence, and clean up each feature that has drift. Use
the current code values, not the old map values. Keep the evidence after
cleanup, as the [live-drive gate](#live-drive-gate) requires. Write the feature
name and the surviving evidence path into `LIVE_DRIVE.md`.

### 3. Decide what drift is

The code is not always correct. Drift can be a stale map or a broken app.

- If the app does what the code intends, the map is stale. Edit the map.
- If the app does not do what the code or the user intends, the app has a
  product regression. Report it as a product regression with the evidence.
  Do not rewrite the map to match broken behavior. Keep the old step in the
  map.

### 4. End in one outcome

The pass ends in exactly one of these three outcomes:

- **clean:** no reader reported drift. Make no edits.
- **changed:** you edited files only inside `.vs/verify-map/`. List each edited
  file, the old step, the new step, and the evidence path from step 2.
- **blocked:** the pass cannot finish. Name the blocker: the app does not
  launch, Doctor fails, auth is missing, a product regression stops the drive,
  or the evidence did not survive cleanup. Make no partial edits.

A product regression is not map drift. Report it next to the outcome, not as a
map edit. If the regression stops the live pass, the outcome is blocked.

## Output tree

```
.vs/verify-map/README.md          # Launch, Doctor, Drive, Evidence, Cleanup, Isolate
.vs/verify-map/features/README.md
.vs/verify-map/features/<feature>.md
.vs/verify-map/LIVE_DRIVE.md      # one driven feature + evidence path that survived cleanup
```

Do not generate a project-local skill. Generate a map. The output is the project
tree above, not a vs skill folder.

## Consumers

`/vs-verify` and `/vs-qa` read Launch and Doctor (and the relevant feature file)
before claiming PASS. Verify stays a cheapest-sufficient claim checker. QA still
explores user-visible behavior; it uses the map for launch, doctor, and drive.

