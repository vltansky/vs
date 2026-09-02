# Verify map

A project-local cold-read so `/vs-verify` and `/vs-qa` launch, doctor, and drive
the app instead of guessing. Generate a **map**, not a skill. Write it into the
**target project** at `.vs/verify-map/`. Do not write it into vs skills and do
not write it into `~/.vs/` session artifacts.

The map is for the next agent that has never seen the app. No placeholders.
Ask the user only what the checkout cannot answer.

## When to generate

If `.vs/verify-map/` is missing, generate it once from this file. If a map
exists, consume it. A stale map gets a scratch diff in the same spirit as
`/vs-tune-skill`: do not silently overwrite, and do not grow a factory inside
`vs-verify` or `vs-qa`.

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

