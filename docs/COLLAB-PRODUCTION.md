# Collaboration: Production Deployment Guide

This document describes the token/room/identity contract, the elected-writer
write-back mechanism, and the recommended architecture for deploying
pptx-viewer's real-time collaboration in production.

## Overview

pptx-viewer uses **Yjs** (CRDT) for conflict-free merging of slide edits and
**y-websocket** as the transport protocol. Any server that speaks the
y-websocket handshake works; [Hocuspocus](https://hocuspocus.dev) is the
recommended choice for production because it adds auth hooks, persistence
extensions, and awareness routing out of the box.

A minimal server example is at:
`demos/collab-server-hocuspocus.example.mjs`

---

## Identity and Room Contract

### `roomId`

- Type: `string`
- Constraints: 1-128 characters, alphanumeric + hyphen + underscore (`[A-Za-z0-9_-]`)
- Maps to a single Y.Doc on the server; all clients with the same `roomId` share the same collaborative document.
- The viewer validates `roomId` before connecting and rejects invalid values with `status = 'error'`.

### `userName`

- Displayed in remote-cursor labels and presence overlays.
- Stripped of HTML, trimmed, and clamped to 64 characters by the viewer. Supply the pre-sanitized display name from your identity provider.

### `userColor`

- Optional hex color (`#rrggbb`) for the cursor/presence badge.
- Falls back to a deterministic palette color if omitted or invalid.

### `authToken`

- Optional bearer token forwarded to the server as a `token` query parameter on the websocket URL.
- Validated server-side in the `onAuthenticate` hook (Hocuspocus) or your own JWT middleware.
- Never expose raw session cookies or long-lived secrets as the token; use short-lived signed tokens (e.g. JWT with 1-hour expiry).

### `role`

- `'owner'` | `'collaborator'` | `'viewer'`
- The server is the authority: your `onAuthenticate` hook should assert the role and reject clients that claim a role they don't hold.
- `'owner'` clients run the elected-writer write-back (see below).

---

## Y.Doc Schema

The viewer uses a single Y.Array named `pptx:slides` as the shared state root.
All slide structure is encoded as nested `Y.Map` / `Y.Array` / `Y.Text` types;
no monolithic JSON blob is stored in the Y.Doc.

```
Y.Doc
  pptx:slides  (Y.Array)
    [0]  (Y.Map)  -- slide 0
      id           string
      elements     (Y.Array)
        [0]  (Y.Map)  -- element 0
          id         string
          type       string
          x, y, ...  number
          textBody   (Y.Text)  -- delta-encoded TextSegment[]
          _ts        string    -- JSON: textStyle
          ...
      _tr          string    -- JSON: transition
      ...
    [1]  ...
```

The schema is defined in `packages/shared/src/render/collaboration-sync.ts` and
`packages/tools/src/codec/pptx-codec.ts` (used by the MCP server and CLI).

---

## Elected-Writer Write-Back

Only the **`role === 'owner'`** client is responsible for persisting the
collaborative state back to a durable PPTX file. This avoids thundering-herd
saves from many simultaneous collaborators.

### How it works

1. The owner client watches the `pptx:slides` Y.Array for changes.
2. When a change arrives, it starts a debounce timer (default 5 seconds;
   configurable via `writeBackDebounceMs`).
3. After the debounce settles, the owner calls `config.onWriteBack(bytes)`,
   where `bytes` is a `Uint8Array` containing the fully serialized PPTX.

### Configuring write-back

```ts
import { PowerPointViewer } from 'pptx-viewer';

<PowerPointViewer
  collaboration={{
    serverUrl: 'wss://collab.example.com',
    roomId: 'doc-abc123',
    userName: user.displayName,
    authToken: await getShortLivedToken(),
    role: 'owner',               // only owner triggers write-back
    writeBackDebounceMs: 10_000, // optional, default 5000
    onWriteBack: async (bytes) => {
      await fetch('/api/documents/doc-abc123', {
        method: 'PUT',
        body: bytes,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    },
  }}
/>
```

### Ownership transfer

If the owner disconnects, the server (or your application layer) is responsible
for promoting another collaborator to `owner` and issuing them a new `authToken`
with the `owner` role claim. The new owner will resume write-back from the
current Y.Doc state automatically when it reconnects.

---

## Server Setup (Hocuspocus)

```bash
npm install @hocuspocus/server @hocuspocus/extension-database
node demos/collab-server-hocuspocus.example.mjs
```

### Token validation pattern

```js
import { Server } from '@hocuspocus/server';
import { verify } from 'jsonwebtoken';

Server.configure({
	async onAuthenticate({ token }) {
		const payload = verify(token, process.env.JWT_SECRET);
		// payload.sub = userId, payload.role = 'owner' | 'collaborator' | 'viewer'
		return { userId: payload.sub, role: payload.role };
	},
	// ...
}).listen(1234);
```

### Persistence

Use `@hocuspocus/extension-database` to restore Y.Doc state on reconnect.
Store the binary Y.Doc update (not the PPTX) for fast startup; the PPTX is
only written by the elected owner via `onWriteBack`.

---

## Security Checklist

- [ ] Validate `authToken` in `onAuthenticate`; reject connections without a valid token.
- [ ] Assert the claimed `role` server-side; do not trust client-supplied role values.
- [ ] Use short-lived (1-hour) signed tokens; rotate on reconnect.
- [ ] Validate `roomId` format server-side (alphanumeric, 1-128 chars); reject others.
- [ ] Rate-limit Y.Doc updates per connection to prevent resource exhaustion.
- [ ] Use TLS (`wss://`) in production; the viewer will refuse a `ws://` URL when
      the page is served over HTTPS (mixed-content block).
- [ ] Scope each `roomId` to a tenant or organization; never share room IDs across
      trust boundaries.
