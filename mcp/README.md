# VS artifact MCP

The bundled local server uses Node.js 24 or later. It reads portable HTMDX
files under `~/.vs`, presents them as MCP Apps, and stores feedback separately
in `~/.vs/.mcp`. It does not upload the project tree or rewrite HTML on review.

## Library and review

Ask the agent to open the VS library (`vs.library`). Search saved artifacts,
filter by project, and select one to preview it. Existing `vs.show-me` and
`vs.eli5` calls still open their saved files directly. The plugin supplies a VS
icon; placement and launch affordances belong to the host.

The App refreshes the generated review overlay in its sandboxed display copy.
Select text or use Comments → Add comment to leave anchored feedback. A save
failure stays visible and offers Retry. Feedback survives reopening the App;
comments on older document revisions are labelled. A newer HTML revision must
be reopened before adding new feedback. Standalone HTML retains browser-local
comments, which are not automatically imported into MCP storage.

| Tool | Purpose |
| --- | --- |
| `vs.library` | Search and paginate artifacts; filter by project |
| `vs.open-artifact` | Read a library artifact's HTML and revision |
| `vs.comments` | Read durable feedback for an artifact ID |
| `vs.save-comment` | Persist anchored feedback; retries reuse the comment ID |
| `vs.resolve-comment` | Resolve or reopen existing feedback |
| `vs.show-me`, `vs.eli5` | Existing path-based presentation |

## Findings review

Pass `findings` and optional `constraints` to `vs.show-me` or `vs.eli5` to show
an actionable review beside the saved artifact. Each finding needs a unique
`id`, `title`, `summary`, proposed `request`, and an `evidence` array containing
at least one `{ source, quote? }` record. Up to 12 findings are accepted.

Readers can choose draft, investigate, disagree or defer, add per-finding
directions, edit shared constraints, and inspect the exact request. Review and
send opens an explicit confirmation before the App calls `ui/message` with
`role: user`. Host rejection and uncertain delivery remain visible. A host
without text messaging gets a copy/manual-paste fallback. Selection alone never
sends a message or authorizes implementation.

Findings and unsent choices belong to that presentation, not the comment store.
Reopening through the library restores durable comments; to review findings,
present the artifact again with its findings. Artifact navigation cancels any
pending confirmation. The Artifact tab retains the sandboxed HTML and its
existing comment flow.

## Comment events

In a host supporting MCP Events, ask: “Watch this VS artifact for new comments
and acknowledge the feedback.” Supply the artifact ID from `vs.library`. To
request edits, explicitly state that in the monitoring instructions.

The server advertises `comment.created` through MCP 2.0 `server/discover` and
`events/list`. Subscriptions require `artifact_id`; an optional `project_id`
must match that artifact. It verifies callback challenges, signs Standard
Webhooks deliveries, persists subscriptions and pending delivery, retries
transient failures, and stops subscriptions on unsubscribe or expiry. Event
payloads carry the comment, anchor, and source revision as user-authored data.
Delivered events do not independently authorize source edits.

Callbacks must be public HTTPS addresses. DNS is validated and pinned for each
connection; private destinations and redirects are rejected. Subscription
secrets remain in a private SQLite database outside the artifact sandbox.

The service grants at most 24 hours per subscription, including requests for
unlimited TTL; the host refreshes it before expiry. There is no historical
replay (`cursor: null`). Retry attempts are bounded; terminal failures are
recorded in `.mcp/events.sqlite` and reported on stderr. The local machine and
MCP service must keep running. This local OS-user service is not an
authenticated multi-user HTTP deployment.

OpenAI currently documents Events for Work on web, desktop Work with Cloud
selected, and dots. An installed local plugin alone does not prove Cloud can
reach its MCP connection. Real ChatGPT subscription/delivery and icon placement
must be tested on the target host. Hosting and remote authentication are a
separate deployment step. See [OpenAI MCP Events](https://developers.openai.com/plugins/build/mcp-events).

## Build and verify

```sh
npm ci
npm run build:mcp
npm run typecheck
npm run eval:static
npm run eval -- mcp/server.eval.ts mcp/events.eval.ts mcp/events-cancellation.eval.ts mcp/webhook.eval.ts mcp/browser.eval.ts
npm run eval -- mcp/view.eval.ts mcp/findings.eval.ts
```

Browser evals use `CHROME_PATH` when set, otherwise the usual Chrome path on
macOS or Linux. `VS_MCP_EVIDENCE_DIR` saves browser screenshots to an existing
directory outside the repository. They use a local MCP Apps host bridge and
the real server. The webhook tests use a controlled transport rather than
posting artifact feedback to ChatGPT.
