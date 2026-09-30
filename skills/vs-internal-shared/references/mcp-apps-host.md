# MCP Apps host presentation

Progressive enhancement for HTMDX deliverables from `/vs-show-me` and
`/vs-eli5`. When the host supports [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
(`io.modelcontextprotocol/ui`), present the saved artifact as an App UI. When it
does not, keep the portable `.html` + URL + first-screen shot + chat TLDR path.
This is not a ChatGPT-only plugin and not a React rewrite of HTMDX.

Spec references: SEP-1865 / `@modelcontextprotocol/ext-apps`
(`text/html;profile=mcp-app`, `_meta.ui.resourceUri` → `ui://…`). OpenAI
sidebar, file, and composer entrypoints are out of scope.

## Detect or assume host support

Treat the host as MCP Apps-capable when **any** of these hold:

1. **Negotiated capability.** The client advertised
   `capabilities.extensions["io.modelcontextprotocol/ui"]` with
   `mimeTypes` including `text/html;profile=mcp-app`.
2. **Host docs or tools say so.** The current host documents MCP Apps (or an
   equivalent “render tool result as App UI”) and exposes a render / present
   tool the agent can call with a `ui://` resource.
3. **Explicit user or caller instruction** that this session supports MCP Apps.

Otherwise assume **no** App support. Grok Bot and other non-App hosts always
take the fallback path below — do not invent an MCP server or iframe host just
to force Apps.

When unsure, prefer the fallback. Emitting an App shape a host cannot render
hides the artifact; the portable file path never does.

## Emit path (App-capable hosts)

Run this **after** the HTMDX artifact is saved, linted, and render-checked the
same way `/vs-show-me` already requires. Apps enhance presentation; they do not
replace authoring.

1. Keep the canonical portable `.html` on disk (and in `Saved:`). The App wraps
   that HTML; it is not a second source of truth.
2. Present via the host’s MCP App / render tool with a UI resource:
   - `/vs-show-me` → `ui://vs/show-me`
   - `/vs-eli5` → `ui://vs/eli5`
3. Resource contents:
   - `uri`: the `ui://…` above
   - `mimeType`: `text/html;profile=mcp-app`
   - `text` (or `blob`): the saved HTML document
4. Tool result / presentation payload:
   - Put the critical review payload in both `content` (short text the model and
     text-only hosts can use — review question, path, TLDR) and
     `structuredContent` (machine fields: `artifactPath`, `reviewQuestion`,
     `url`, `skill`, optional `shotPath`).
   - Associate the tool with the UI resource via `_meta.ui.resourceUri`
     (preferred). Optionally also set `_meta["openai/outputTemplate"]` to the
     same `ui://…` as a ChatGPT compatibility alias — never as the only key.
5. Still include the chat TLDR (two to four short lines). The App is the visual
   surface; chat stays summary-first.

Shape helper (documents the wrap; does not start a server):

```bash
node skills/vs-show-me/scripts/mcp-app-resource-shape.mjs \
  --skill show-me \
  --html "$ARTIFACT_PATH" \
  --review-question "…"
```

## Fallback (mandatory on non-App hosts)

When the host is not MCP Apps-capable — including Grok Bot — keep the existing
`/vs-show-me` handoff unchanged:

- portable `.html` on disk
- openable `URL:` (localhost / https / `file://`)
- attached first-screen `Shot:` (or `Shot failed: <reason>`)
- chat TLDR

Do not skip the file, URL, shot, or TLDR because an App path exists in this
reference. Apps are additive.

## CSP note

MCP Apps hosts render UI in a sandboxed iframe and enforce CSP from
`_meta.ui.csp` on the resource (restrictive defaults when omitted). vs HTMDX
shells pin the runtime from a CDN (`cdn.jsdelivr.net` / `@wix/htmdx@4`). If that
CDN-pinned runtime cannot load inside the App iframe (missing
`resourceDomains`, blocked script, blank compile), **keep the file fallback** —
do not block the handoff on App render, and do not introduce a full bundler in
this cut. Declaring `resourceDomains` that include the HTMDX CDN is allowed when
the host honors CSP metadata; proving iframe load is a later hardening step.

## Out of scope

- OpenAI sidebar / file / composer plugin entrypoints
- Rewriting HTMDX into a React host app
- Building a standalone MCP server plugin unless the repo already has one to
  extend (vs currently does not for show-me/eli5)
- Changing pathgrade, ship-it presets, or PR walkthrough
