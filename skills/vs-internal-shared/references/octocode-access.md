# Octocode access ladder

Skills that need GitHub-backed evidence (`/vs-github-research`,
`/vs-rfc-research`, `/vs-steal`, prior-art passes in `/vs-shape-it` and
`/vs-pushback`) go through Octocode. There are two ways to reach it. Use the
first one that is actually available; do not silently downgrade further.

## 1. MCP tools (preferred)

The vs plugin ships `octocode` in its `.mcp.json`. When `mcp__octocode__*` tools
are in the session, call them directly — typed inputs, structured results, no
process start per call.

Do not load or invoke Octocode's own prompt, skill, or orchestration workflows
(for example `reviewPR`). The calling skill owns the research plan.

## 2. Octocode CLI (fallback when MCP is not loaded)

The CLI exposes the same tools as the MCP server, with the same names and the
same query payloads. A missing MCP server is no longer a reason to stop.

```bash
npx -y octocode-cli@latest --tool <toolName> --queries '<json>' --json
```

```bash
npx -y octocode-cli@latest --tool githubSearchCode \
  --queries '{"keywordsToSearch":["useSyncExternalStore"],"owner":"facebook","repo":"react"}' --json
```

- Tool names are identical to MCP: `githubSearchCode`, `githubGetFileContent`,
  `githubViewRepoStructure`, `githubSearchRepositories`,
  `githubSearchPullRequests`, `packageSearch`, plus `local*` and `lsp*` tools.
- `--queries` takes the JSON-stringified tool input — the same object you would
  pass over MCP, including `mainResearchGoal`, `researchGoal`, and `reasoning`.
- `--tool <name> --help` prints that tool's input/output schema.
  `--tools-context` prints the full instructions plus every schema.
- `--json` prints `structuredContent` only. Pipe into `jq`.
- Exit `0` on success, `1` on missing flag, bad stdin, validation, or tool error.
- Auth comes from Octocode-stored credentials, then the `gh` CLI token
  (`octocode-cli login` or `gh auth login`).
- Independent calls should be issued in one message so they run concurrently.
  One process start per call is the CLI's main cost; do not loop sequentially.
- If `npx` resolves against an internal registry (Wix machines default to
  `npm.dev.wixpress.com`), add `--registry https://registry.npmjs.org` or
  connect the VPN.

Say in the report that Octocode ran through the CLI rather than MCP, and that
the host may need to reload or reinstall plugin MCP config.

## 3. Neither available

`gh` (`gh api repos/owner/repo/contents/path`, `gh search code`) is a degraded
last resort: no ranked snippets, no structured research payloads. Label the
findings as degraded-tooling evidence.

Web snippets and local files are not substitutes for GitHub-backed evidence.
When the question requires external prior art and none of the above works, stop
and say so rather than dressing up weaker sources as research.
