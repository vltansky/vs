---
name: vs-disk-cleanup
description: "Free disk space left behind by coding agents: stale git worktrees (t3code, Codex, Claude Code), old vs session artifacts under ~/.vs, and home-folder dev leftovers. Removes only provably safe items and asks about the rest. Use when the user says /vs-disk-cleanup, cleanup/prune/remove worktrees, orphaned worktrees, clean ~/.vs, old vs reports or videos, out of disk space, disk full, no space left, free up space, or disk cleanup."
---

# Disk Cleanup

Agent worktrees and session artifacts pile up fast (tens of GB). Delete only what is recoverable; everything else is the user's call.

When running bundled scripts, first resolve this skill directory and use it as
`$VS_DISK_CLEANUP_DIR`. In this repository the source path is
`skills/vs-disk-cleanup`; in an installed agent runtime, use the installed
skill directory exposed by that runtime.

Report in the shape defined by
[`../vs-internal-shared/references/output-style.md`](../vs-internal-shared/references/output-style.md).

## Entry points

| User names | Start at |
|---|---|
| worktrees | step 1 |
| `~/.vs`, vs reports, videos, artifacts | step 3 |
| home folder, dev leftovers, disk space in general | step 6 (its report already covers worktrees and `~/.vs` as review items) |
| plain "cleanup" | step 1, then 3; offer 4 and 6 only if space is still tight |

## 1. Inventory worktrees (read-only)

```bash
bash "$VS_DISK_CLEANUP_DIR/scripts/inventory.sh" > "<scratchpad>/wt.tsv"; df -h /System/Volumes/Data
```

- Options: `DAYS=7` (idle threshold) and `WT_ROOTS="dir1 dir2"` (override the scanned roots). The script prints TSV columns: `status path branch last_activity reason`.
- Use `/System/Volumes/Data`, not `/`, for disk numbers on macOS. On APFS, `/` is the sealed system volume and its free-space figure is misleading.
- It is slow because of `lsof` and many repos. Run it with a long timeout (300s+) or in the background, and **don't add `du`** to the same command, since `du` over 70G times out.

| Status | Rule | Action |
|---|---|---|
| `SAFE` | no tracked changes, 0 commits missing from remotes, idle >= DAYS, no process cwd inside, untracked files are only junk (`node_modules`, `build/`, `.playwright-mcp/`, logs...), no gitignored secrets (`.env*`, keys) | remove |
| `BUSY` | some process has its cwd inside | never touch |
| `RECENT` | last commit, or the newest changed or untracked non-junk file, within DAYS. The worktree root's own mtime doesn't count: any tool writing at the root bumps it | never touch |
| `DECIDE` | uncommitted changes, unpushed commits, real untracked files (ADRs, prototypes, docs, an uncommitted `.vs/verify-map/`), or gitignored secrets | ask the user |

## 2. Remove the SAFE worktrees

If there are 0 SAFE rows, skip this step.

The user asking to "cleanup" counts as consent for `SAFE` rows only. Before removing anything, state the list you are about to remove.

```bash
awk -F'\t' '$1=="SAFE"{print $2}' "<scratchpad>/wt.tsv" | bash "$VS_DISK_CLEANUP_DIR/scripts/remove.sh"
```

`remove.sh` re-runs the full classification from `checks.sh` on each path and skips anything that is no longer SAFE, then runs `git worktree remove --force`. It then deletes the local branch, which stays recoverable from the remote, runs `git worktree prune` on each main repo, and prints the MB freed. Use it rather than hand-written `rm`, because removing the directory alone leaves the branch and the git metadata behind.

## 3. vs session artifacts (`~/.vs`)

vs skills write reports, videos, prototypes and evidence to `~/.vs/<project>/<kind>/`. Most are one-session renderings; a few kinds are durable records later runs read back.

```bash
bash "$VS_DISK_CLEANUP_DIR/scripts/vs-artifacts.sh" > "<scratchpad>/vs.tsv"; du -sh ~/.vs
```

- Options: `DAYS=30` (idle threshold, by newest file mtime) and `VS_HOME` (default `~/.vs`). TSV columns: `status kb last_used path reason`.
- Render kinds are listed per entry, so one recent report doesn't shield stale ones beside it. All other kinds are listed as one row per kind dir.

| Status | Rule | Action |
|---|---|---|
| `STALE` | entry in a render kind (`videos`, `vs-show-me`, `build-it`, `ship-it`, `qa-reports`, `prototypes`, `explanations`, `eli5`, `reviews`, `verification`, `pushback`, `steals`, `thread-analysis`, `briefs`, `vs-octocode`, `pr-<N>`), idle >= DAYS | move to Trash |
| `RECENT` | render-kind entry used within DAYS | never touch |
| `KEEP` | durable kind (`specs`, `rfcs`, `issues`, `context`, `improve`) or a regression `baseline.json`/`baseline.png` | never offered |
| `REVIEW` | `sessions/` handoffs, `perf/` baselines, unknown kinds, loose files | ask the user |

The user asking to clean `~/.vs` (or a plain "cleanup") counts as consent for `STALE` rows only. State the count and total MB by kind, largest first, then run:

```bash
awk -F'\t' '$1=="STALE"{print $4}' "<scratchpad>/vs.tsv" | bash "$VS_DISK_CLEANUP_DIR/scripts/vs-artifacts.sh" --remove
```

- `--remove` re-classifies each path, refuses anything outside `~/.vs/<project>/` or not `STALE` right now, and refuses a whole render-kind dir (it would sweep baselines). It moves entries to Trash (`trash`, else `~/.Trash`), then deletes the kind and project dirs left empty.
- Say that space frees only after Trash is emptied, and never empty Trash yourself.
- Never delete `KEEP` rows. A spec or RFC is a decision record; losing it is not recoverable by re-running a skill.

## 4. Slim DECIDE worktrees (when disk is still tight)

`node_modules`, `.cache` and native build dirs make up most of a worktree's size. Deleting them keeps every commit, change and untracked file, so it needs no per-worktree approval. But they just rebuild, so **propose it rather than doing it by default**. Offer only worktrees idle for 14 days or more (`DAYS=14` inventory), state the dry-run size, and run it on a yes:

```bash
awk -F'\t' '$1=="DECIDE"{print $2}' "<scratchpad>/wt.tsv" | bash "$VS_DISK_CLEANUP_DIR/scripts/slim.sh"
```

- Add `--dry-run` to list the sizes without deleting anything.
- The script deletes only paths that `git check-ignore` confirms are ignored, and it skips worktrees that are BUSY. Never run it on RECENT or BUSY rows, because they may be in use.
- Deleting millions of files takes more than 10 minutes. Always run it in the background, then wait for the final `deleted N dirs; freed:` line.
- Expect to free about half of what `--dry-run`/`du` reports. pnpm hard-links files from its store, so `du` counts space that deleting doesn't free.
- `SKIP not-ignored .../node_modules` lines are expected. Some repos commit `node_modules` as test fixtures.
- Tell the user they need `pnpm install` (or the repo's package manager) before working in a slimmed worktree again.

## 5. Report

- Report the MB freed and the free space before and after, plus MB moved to Trash from `~/.vs`.
- Show a table of `DECIDE` worktrees grouped by reason (uncommitted N / unpushed N / untracked files / secrets), sorted by size, largest first. Measure them with `du -sk` on the DECIDE paths only.
- Call out `unpushed=N (upstream gone, likely merged)` rows separately. These branches were usually squash-merged, so they are the easiest ones to approve. The unpushed count uses local remote refs (no `git fetch`), so it can be stale.
- List `REVIEW` rows from `~/.vs` with size and last used.
- Offer options for `DECIDE` rows; don't act on them yet:
  - Save first, then remove: `... | bash "$VS_DISK_CLEANUP_DIR/scripts/remove.sh" --backup <dir>`. For each DECIDE row it writes `<dir>/<parent>-<name>.patch` (`git diff HEAD --binary`) and `.files.tgz` (untracked files plus ignored secrets, no `node_modules`). It then removes the worktree and keeps the local branch, so unpushed commits stay in the main repo. Without `--backup`, DECIDE rows are skipped.
  - Push the unpushed branch, then remove.
  - Remove anyway: needs explicit user approval per group.
- If space is still tight, go to step 6 instead of ad-hoc `du`.

## 6. Dev-leftovers report (beyond worktrees)

Read-only scan of the home folder: sizes only (`du`, `stat` mtimes), never file contents. It skips iCloud, Photos, external drives and TCC-protected folders (Desktop/Documents/Downloads, Mail, Messages, Safari, app Containers, Trash), so it raises no permission prompts.

```bash
node "$VS_DISK_CLEANUP_DIR/scripts/disk-report/scan.mts"   # ~6 min; run in the background
```

- It reads `~/disk-report/sizes.csv` first, then appends this scan's rows. It flags items that grew by at least 100 MB and 5% since the previous scan. Lead the report with those, excluded ones included: they explain where space goes even though they are never offered.
- Reuse: if `~/disk-report/latest.json` has a `scannedAt` less than 1 hour old and nothing was deleted since, reuse it instead of rescanning.
- It writes `~/disk-report/index.html`: a treemap plus tables with path, size, last used and what happens if deleted. Ticking items there generates `cleanup.sh`. It also writes `~/disk-report/latest.json`, which `cleanup.mts` reads.
- Grouping rules:
  - **Excluded, never offered:** whole package-manager caches (npm, Yarn, pnpm, uv, pip, Gradle, CocoaPods, Cargo, Go, Bun, Homebrew, node-gyp, Electron). They refill on the next install. Also any *safe* item touched in the last 14 days (`ACTIVE_DAYS`), meaning it is in use and would just rebuild. Both stay in the CSV for growth tracking.
  - **Prune items, offered even while active:** the stale parts of those caches. `pnpm store prune` and `uv cache prune` (drop only unreferenced entries, often a fraction of the size shown), npx envs unused 30+ days, Yarn Berry zips unused 60+ days, Gradle versions (cache plus wrapper) no build ran for 30+ days, the newest kept. Also Codex update leftovers older than a day: `.codex/.tmp/marketplaces/.staging/*`, `marketplace-backup-*` and `.cache/codex-runtimes/codex-runtime-install-*`. Codex never deletes these, and they reach tens of GB.
  - **Let me review first:** sessions, models and Docker always go here, along with worktrees, `~/.vs` artifacts, simulators/AVDs, runtimes and unknown tools' caches. This group needs explicit per-item approval.
    - Colima: on each running profile, the clean command prunes stopped containers and unused images (`docker image prune -a`), then runs `fstrim` in the VM. The VM disk is a sparse file, so a prune without `fstrim` frees nothing on the Mac. Volumes are kept, and stopped profiles only get a `colima delete <profile>` suggestion. Before asking, list each profile's images with `docker --context colima[-<profile>] images`. Images that were built locally can't be pulled again.
  - **Safe to remove:** stale, regenerable items (old project `node_modules`/build dirs, Xcode DerivedData, iOS DeviceSupport).
- To remove, first show the item list with sizes, taken from `latest.json`. Once the user approves, generate the script with `--yes` (the y/N prompt would abort in a background run) and run it. Each item uses its tool's own clean command; the `~/.vs` item runs step 3's `vs-artifacts.sh` pipeline, never a whole-dir delete:
  ```bash
  node "$VS_DISK_CLEANUP_DIR/scripts/disk-report/cleanup.mts" --group safe --yes > "<scratchpad>/cleanup.sh"   # or --ids a,b
  bash "<scratchpad>/cleanup.sh"   # long: run in the background
  ```
  - `rm_regen` (safe items) deletes permanently, but inside a git repo it deletes only paths `git check-ignore` confirms, so committed `node_modules` are skipped.
  - `rm_safe` (review items) moves to Trash. Say that space frees only after Trash is emptied.
  - The script prints the MB freed. As with slim, expect less than `du` reports because of pnpm hard links.
- Not dev, so not in the report: `~/Library/Application Support/com.apple.wallpaper` (Aerial wallpapers, tens of GB). Mention it if space is critical.

## Gotchas

- `git worktree remove` must run from the main repo. The script resolves it via `git rev-parse --git-common-dir`.
- `--force` also deletes gitignored files. That is why the inventory checks `git status --ignored` for `.env*` and key files. It marks a worktree DECIDE only when such a file is missing from the main checkout or differs from it; byte-identical setup copies don't count.
- An untracked `.vs/` inside a worktree is not junk: `.vs/verify-map/` is committed source-of-truth, so an uncommitted one is real work.
- `BUSY` often means an idle shell or agent left running. Point that out, but never kill processes.
- Detached-HEAD worktrees with 0 unpushed commits count as SAFE because their commit is already on a remote.
- Paths under `~/.codex/worktrees/<id>/` are left empty after removal. `remove.sh` deletes the empty parent dir.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** disk full | after a run of agent sessions
**Next:** done
**Relevant:** none
