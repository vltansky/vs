# Persist MCP artifact feedback outside portable HTML

Date: 2026-10-18

## Context

VS already serves portable HTMDX files through MCP Apps. Browser-local review
comments cannot reach a subscribed ChatGPT chat or survive the App sandbox.
The artifact library must discover existing files without uploading the user's
project tree, and events must not grant authority to edit source files.

## Decision

Keep HTML under `~/.vs` as the authored source of truth. Discover artifacts
within that root and persist MCP review comments and pending comment events in
a local SQLite database under `~/.vs/.mcp`. Identify artifacts by their relative
path and identify revisions by the HTML content hash. Store the revision with
each comment so feedback on an older document is not silently rebased.

The MCP App's trusted outer view owns persistence. Its sandboxed artifact frame
can submit anchored feedback through a narrowly validated message bridge;
artifact scripts never receive event subscription secrets. Standalone HTML
retains browser-local comments. Existing standalone feedback is not silently
uploaded or merged.

Expose a library App and `comment.created` subscriptions through MCP 2.0.
Deliver signed, verified HTTPS webhooks only to matching subscriptions. Persist
the comment and its pending event together, use stable event IDs across retries,
and make duplicate publication harmless. Delivery does not itself authorize
source edits: the subscribing chat follows the user's monitoring instructions.

Ship the local service first. Hosted storage, account authentication, continuous
operation while the computer is off, and guaranteed ChatGPT sidebar placement
require separate deployment and host integration evidence.

## Alternatives and consequences

- Browser storage alone preserves portability but cannot support durable events.
- Embedding comments in HTML couples reviewer state to authored content and
  makes concurrent feedback overwrite source revisions.
- A hosted database would add a deployment and authentication boundary before
  the first usable slice; local SQLite supports concurrent local MCP clients
  without introducing a service dependency.
- Comments remain outside exported HTML. Live ChatGPT delivery still needs a
  supported Work/Cloud surface and a running, reachable MCP connection.
