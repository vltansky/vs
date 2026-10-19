# explain-video benchmark

A repeatable speed and token-cost benchmark for `skills/vs-explain-video`.
Run it before and after a change to the skill, and compare the numbers.

```bash
npm run bench:explain-video                  # 2 briefs x 5 runs, record a row
npm run bench:explain-video -- --set-baseline  # same, and mark it the baseline
npm run bench:explain-video -- --runs 1 --brief dns-lookup --no-record  # quick look
npm run bench:explain-video:compare          # newest row vs the baseline
npm run bench:explain-video:compare -- --time 0.3 --tokens 0.1
```

It is opt-in. `eval:static`, `npm run eval`, and CI never run it. One full run
(6 videos) takes about 20 minutes and costs cents with the default model.

## What one run does

PathGrade starts a live agent (Codex on the repository default model; set
`PATHGRADE_AGENT` / `PATHGRADE_CODEX_MODEL` to change it) in a fresh
workspace and asks it to make a 20-40 second video from one brief in
`briefs.json`, following the skill to the end. The voice is the free local
kokoro voice; `ELEVENLABS_API_KEY` is blanked for the agent, so no paid TTS
runs.

Per run it records:

| Field | Source |
| --- | --- |
| `wallMs` | prompt sent to agent reply |
| `stages` | `stage-hook.mjs` timestamps of the skill's scripts (see below) |
| `steps` | count, summed time, and last exit of each script, so reruns show |
| `tokens` | Codex app-server `thread/tokenUsage/updated`, read by the `bin/codex` tap; Claude: PathGrade's token count |
| `toolCalls` | Codex `item/started` tool items; Claude: PathGrade tool events |
| `costUsd` | the agent's own cost when it reports one (Claude); else tokens x `prices.json` |
| `videoSec` | ffprobe of the mp4 the last full render wrote |
| `checks` | last exit of check-ste, `render --stills`, `check.mjs`, the full render, the mp4 on disk, and `length` (`videoSec` is 20-40 s, as the brief asks; a run outside it or with no mp4 fails); `review` is the fresh-review verdict, reported but not required |

Stages split the wall time at the first time each step happens, so they always
add up to `wallMs`: `setup` (to the first good `init.mjs`), `script` (to the
first real narrate), `narrate`, `scenes` (to the first `--stills`), `checks`
(to the first full render), `render`, `review` (to the last render, pack, or
verdict), `handoff`.

Each brief runs N times (default 5). The row stores every run plus, per
metric, the median, min, max, and spread ((max - min) / median).

## History and compare

`history.jsonl` gets one row per benchmark: date, git sha, the git tree of
`skills/` (same tree = same skill code, even after a rebase), agent, model,
CLI version, machine, and the per-brief results. `SUMMARY.md` is rewritten from
the newest row. Commit both.

Compare uses the medians. Agent runs vary a lot: one run can start a
fresh-review agent and take twice as long. So a metric is a regression only
when both are true:

1. The latest median is above the baseline's max. No baseline run went that
   high, so it is not run-to-run noise. A one-run baseline has no range, so
   only rule 2 applies.
2. It grew by more than its limit: time +20%, tokens +15%, cost +15%, tool
   calls +25%.

Time metrics whose baseline is under 5 s are never flagged. Fewer passing runs
is always flagged. Sometimes the latest row has no value for a baseline metric, for
example tokens after a Codex event rename. Compare then prints `no data` and a
warning, never "No regressions". Each line shows n and the spread of both
rows. Every limit is a flag on `compare.mjs`. It only warns: exit 0 either way,
exit 2 when there is no baseline.

The baseline is the newest `baseline` row with the same agent, model, and
machine label (`VS_BENCH_MACHINE`, default platform plus arch, such as `linux-x64`). A row from
another machine is never compared.

## Sandbox notes

The agent's sandbox has its own empty HOME, writes only to the workspace and
`/tmp`, and has no network. So before the runs, `run.mjs` makes the skill's
tools ready on the host under `/tmp/vs-bench-explain-video` (or
`VS_BENCH_TOOL_DIR`): the pinned playwright-core, a warm uv cache for kokoro,
and the fonts. The numbers then measure the skill, not first-time downloads.

On Linux the Codex sandbox's network filter also blocks the socket calls
Chrome needs. So on Linux only, the `bin/codex` tap turns on
`sandbox_workspace_write.network_access` for the benchmark agent. On macOS and
other platforms network stays off. `--network` and `--no-network` override the
default (renders fail on Linux without it). If codex dies on a signal, the tap
exits 128 + the signal number, as a shell does.

Codex does not report cost, so its `costUsd` is computed from tokens with the
prices pinned in `prices.json` (standard tier, short context). Update the
table when prices change, and say so in the PR: it moves every cost number.
