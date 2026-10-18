# Optional inline preview

Use this route only for a small self-contained UI mockup or interactive
explainer the user wants to explore in the conversation, when the host has an
available `visualize` skill and supports its inline rendering contract.
Before authoring, read that skill's complete `SKILL.md` and any references it
requires. Do not vendor its instructions or assume a tool named `visualize`
exists: it is a host capability, not a VS MCP tool.

Keep these on the caller's existing path:

- an explicit file, HTMDX, export, publishing, or project-change request;
- a complex report or proposal governed by the two-layer explanation contract;
- a real app prototype needing authentication, backend access, network requests,
  or runtime fidelity: use the existing app/browser workflow;
- terminal logic harnesses.

If the capability is unavailable, its instructions cannot be read, or the
fragment cannot meet its sandbox limits, continue the existing fallback.
If inline rendering fails, state that gap and present the browser/file fallback
with its required URL and shot; never claim an unseen preview rendered.

## Author and present

Keep all interactions local and stub mutations; no network requests. Follow the
host skill for fragment syntax, allowed resources, theme, interaction state,
verification, and the final response content reference with its absolute file
path. Save in a writable task-owned location chosen by that skill. Do not wrap
an HTMDX document or the standalone prototype scaffold in a fragment: those
have different runtime and document contracts.

For UI alternatives, preserve the caller's structurally distinct directions as
separate designs inside the host's variant carousel. Use the host's design
controls when useful. Do not add VS's fixed switcher, URL parameters, or page
shell inside the preview. Honor an explicit request for one design or a fixed
number of components; three cards do not imply three alternative layouts.

This route replaces the caller's file-scaffolding and presentation steps only.
Keep its question, synthetic fixtures, review boundary, and verification of
the primary interaction. An inline preview does not require a dev server, run
command, portable artifact, URL, or first-screen shot. Follow explicit user
evidence requirements separately. Return the inline content reference in the
final response and a concise review instruction; do not append the file
workflow's handoff checklist. Stop there rather than also creating HTMDX or
starting the fallback on a successful inline handoff.
