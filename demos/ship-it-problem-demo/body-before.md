## Merge risk

<img alt="Two-way door: easy to revert" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-two-way-door.svg">

- Code + Hosting rewrite are two-way: revert Functions export, rewrite entry, and UI card → HTTPS surface gone
- **One-way caveat once tokens are minted:** revoke/delete does not un-show a plaintext secret already copied into an agent vault
- Door badge stays two-way for the code path; treat already-issued tokens as one-way credentials

<img alt="Narrow blast radius: contained" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-narrow-blast.svg">

- New HTTPS function (`maxInstances: 10`)
- Two Admin-SDK-only Firestore collections
- Admin card on `/whatsapp/assistant`
- Does **not** touch `customerEnabled`, Cloud Run `bo-mcp` capacity, MCP OAuth, or live WhatsApp send

## Surfaces

<img alt="Surface: Endpoint · 2 modules" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-endpoint-2.svg"> <img alt="Surface: Schema · 1 module" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-schema-1.svg"> <img alt="Surface: UI · 1 module" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-ui-1.svg">

- **Cloud Functions** (Endpoint) — `previewWhatsappAssistantHttp` + mint/revoke/list callables
- **Firebase Hosting** (Endpoint) — rewrite `POST /api/assistant/preview` → Functions
- **Firestore** (Schema) — `staffApiTokens` + `staffApiTokenHashes` (Admin SDK only)
- **WhatsApp Assistant UI** — `/whatsapp/assistant` admin token card

## What problem this solves

Agents cannot curl the WhatsApp Assistant Playground preview without a browser Firebase Auth session. Admins need mintable, revocable staff tokens so automation can hit a preview-only HTTPS route with the same JSON shape as the existing `onCall` Playground path — without piggybacking MCP OAuth or live send.

## Endpoint

`POST /api/assistant/preview`

```http
POST /api/assistant/preview
Authorization: Bearer rap_live_<tokenId>_<secret>
Content-Type: application/json

{"scenario":"visit","text":"מתי הביקור?","history":[]}
```

```diff
 {
-  "error": "…route missing / unauthorized…"
+  "text": "הביקור ב-10:00",
+  "action": "visit",
+  "revision": 3,
+  "scenario": "visit",
+  "mode": "model",
+  "language": "he",
+  "decision": { "reason": "synthetic_fixture", "disposition": "approved", "attempts": 1 },
+  "history": []
 }
```

## Schema

`staffApiTokens` / `staffApiTokenHashes`

```diff
- (collections absent)
+ companies/{companyId}/staffApiTokens/{tokenId}:
+   tokenPrefix: string
+   tokenHash: string        // SHA-256 hex of full plaintext; never plaintext
+   scopes: ["assistant:preview"]
+   label: string
+   createdBy: string
+   createdAt: Timestamp
+   revokedAt: Timestamp | null
+   lastUsedAt: Timestamp | null
+   expiresAt: Timestamp | null
+
+ staffApiTokenHashes/{tokenHash}:   // Admin SDK O(1) bearer lookup
+   companyId: string
+   tokenId: string
+   scopes: ["assistant:preview"]
+   revokedAt: Timestamp | null
+   expiresAt: Timestamp | null
+
+ // firestore.rules: allow read, write: if false; for both matches
```

> DEMO ONLY — long mixed Why (pain+mechanism) for before shot. Do not merge.
