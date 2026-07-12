# Inline Thread Approval Gate

We are already inside `/vs-fix-pr` Step 4c for a single inline review thread.

The fix is already committed. Do not fetch GitHub state again. Do not post anything yet.

The host exposes `AskUserQuestion` for this gate. Use it for the decision. Do not render the final choice list as plain chat.

Current thread:

> [P2] Include root hooks config in sparse checkout
>
> sparseCheckoutPaths includes .aicm-plugin, hooks/, and skills/ but omits hooks.json. During default remote installs, the clone never fetches hooks.json, so syncCreatorKitPluginMirror() cannot copy it and collectRootPluginHooks() returns no hooks, skipping hook installation in normal use.

Draft reply:
Fixed in d508598: remote installs now sparse-checkout the root hooks.json as well, and the sparse-checkout command uses --skip-checks so Git accepts that root file path. I also added a regression test covering installWithRepo(...) end-to-end hook installation, and removed the stray skills/ck-ux-research/.claude-plugin/plugin.json that was keeping yarn validate red on this branch.

Why:
The review was correct, but the minimal change was not enough by itself because Git rejects root file paths in sparse-checkout set without --skip-checks.

Your job from this state:
- Show the reviewer comment and the draft reply
- Ask for approval on what to do next
- Offer the normal Step 4c options:
  - Post reply and resolve
  - Post reply only
  - Edit reply first
