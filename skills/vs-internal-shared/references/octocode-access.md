# Octocode access ladder

Skills that need GitHub-backed evidence (`/vs-octocode`,
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

The CLI and current MCP server use the same tool names and schema family for
their exposed catalogs; gated tools such as clone may be absent. Check
availability once, read a tool's schema before its first raw call, then use only
fields that schema exposes. A missing MCP server is no longer a reason to stop.

```bash
npx -y octocode@latest context --minimal
npx -y octocode@latest tools <toolName> --scheme --json --compact
npx -y octocode@latest tools <toolName> --queries '<json>' --compact
```

```bash
npx -y octocode@latest tools ghSearchCode \
  --queries '{"keywords":["useSyncExternalStore"],"owner":"facebook","repo":"react","match":"file","concise":true,"limit":10}' --compact
```

- The remote tools are `ghSearchCode`, `ghSearchRepos`, `ghSearchPullRequests`,
  `ghSearchIssues`, `ghSearchCommits`, `ghGetFileContent`,
  `ghViewRepoStructure`, and `ghCloneRepo`; package lookup is `npmSearch`.
- Local tools are `localSearchCode`, `localFindFiles`, `localFindDeadCode`,
  `localGetFileContent`, `localViewStructure`, and `lspGetSemantics`.
- `--queries` takes the JSON-stringified input shown by `--scheme`. MCP calls
  use their exposed typed schema; do not add legacy fields absent from it.
- `--compact` prints compact agent-facing output; use `--json` with schema or
  status commands when structured metadata is needed.
- Check authentication with `npx -y octocode@latest auth status --json`; GitHub
  CLI credentials can be refreshed with `gh auth login`.
- Independent calls should be issued in one message so they run concurrently.
  One process start per call is the CLI's main cost; do not loop sequentially.
- If `npx` resolves against an internal registry (Wix machines default to
  `npm.dev.wixpress.com`), place `--registry=https://registry.npmjs.org`
  immediately after `npx`, or connect the VPN.

Say in the report that Octocode ran through the CLI rather than MCP, and that
the host may need to reload or reinstall plugin MCP config.

## 3. Neither available

`gh` (`gh api repos/owner/repo/contents/path`, `gh search code`) is a degraded
last resort: no ranked snippets, no structured research payloads. Label the
findings as degraded-tooling evidence.

Web snippets and local files are not substitutes for GitHub-backed evidence.
When the question requires external prior art and none of the above works, stop
and say so rather than dressing up weaker sources as research.
