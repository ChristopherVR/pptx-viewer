---
title: Collaboration
description: Real-time multi-user co-editing for PowerPointViewerComponent via Yjs CRDT - the collaboration input, CollaborationConfig shape, presence, and remote cursors.
---

# Collaboration

`PowerPointViewerComponent` supports real-time, multi-user editing built on **Yjs** (a CRDT) with
either a WebSocket transport (`y-websocket`, needs a server) or a serverless peer-to-peer transport
(`y-webrtc`). When enabled, it adds granular CRDT document sync (per slide / element / field), live
remote cursors, selection highlights, user presence, and follow mode. In single-user mode none of
this is loaded.

::: info Optional peer dependencies
Collaboration requires the `yjs` peer plus the provider for your transport: `y-websocket`
(server-based) or `y-webrtc` (peer-to-peer). The viewer works fully without them - it simply runs
single-user. Install them only when you need co-editing:

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## Enabling it: the `collaboration` input

Pass a `CollaborationConfig` to the `collaboration` input. When present, the viewer wires up
presence tracking, remote cursors, and CRDT sync via its internal `CollaborationService`.

```ts
import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import type { CollaborationConfig } from 'pptx-angular-viewer';

@Component({
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `<pptx-viewer [content]="bytes" [canEdit]="true" [collaboration]="config()" />`,
})
export class Example {
	readonly config = signal<CollaborationConfig>({
		roomId: 'my-room-123',
		serverUrl: 'wss://collab.example.com',
		userName: 'Alice',
		userColor: '#6366f1',
	});
}
```

## `CollaborationConfig`

```ts
type CollaborationRole = 'owner' | 'collaborator' | 'viewer';
type CollaborationTransport = 'websocket' | 'webrtc';

interface CollaborationConfig {
	/** Unique room id (alphanumeric, hyphens, underscores). */
	roomId: string;
	/** WebSocket URL for the Yjs provider, e.g. "wss://collab.example.com". Ignored for webrtc. */
	serverUrl: string;
	/** Transport - 'websocket' (default) or serverless 'webrtc'. */
	transport?: CollaborationTransport;
	/** WebRTC signaling server URLs (webrtc transport only). */
	signaling?: string[];
	/** Display name for the local user. */
	userName: string;
	/** Avatar URL for the local user (optional). */
	userAvatar?: string;
	/** Hex colour for the local user's cursor / presence indicator. */
	userColor?: string;
	/** Optional auth token sent with the WebSocket handshake / used as the webrtc room password. */
	authToken?: string;
	/** Session role - defaults to 'collaborator'. */
	role?: CollaborationRole;
	/** Elected-writer persistence: the 'owner' peer receives debounced PPTX snapshots. */
	onWriteBack?: (bytes: Uint8Array) => void;
	/** Debounce (ms) between the last change and onWriteBack. Default 5000. */
	writeBackDebounceMs?: number;
}
```

| Field                 | Type                     | Required | Notes                                                                                           |
| --------------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `roomId`              | `string`                 | yes      | Sanitized; restrict to alphanumeric / `-` / `_`.                                                |
| `serverUrl`           | `string`                 | yes      | `y-websocket` server URL; may be `''` when `transport: 'webrtc'`.                               |
| `transport`           | `CollaborationTransport` | no       | `'websocket'` (default) or `'webrtc'` (serverless P2P).                                         |
| `signaling`           | `string[]`               | no       | y-webrtc signaling URLs; defaults to y-webrtc's public list.                                    |
| `userName`            | `string`                 | yes      | Local user's display name; also used as comment/annotation author when `authorName` is unset.   |
| `userAvatar`          | `string`                 | no       | Validated avatar URL.                                                                           |
| `userColor`           | `string`                 | no       | Hex colour for the user's cursor ring.                                                          |
| `authToken`           | `string`                 | no       | WebSocket handshake param / webrtc room password.                                               |
| `role`                | `CollaborationRole`      | no       | `'owner'`, `'collaborator'` (default), or `'viewer'`.                                           |
| `onWriteBack`         | `(bytes) => void`        | no       | Only fires for the `'owner'` peer: debounced serialized PPTX snapshots for durable persistence. |
| `writeBackDebounceMs` | `number`                 | no       | Default 5000 ms.                                                                                |

### Serverless peer-to-peer mode

With `transport: 'webrtc'` no document server is needed: peers exchange updates directly over
WebRTC, and tabs in the **same browser** connect through BroadcastChannel even with no network at
all. This is how the hosted GitHub Pages demos collaborate. Cross-device sessions meet through
WebRTC signaling servers (metadata only - document data never passes through them); supply your own
via `signaling` for production use. In the built-in Share/Broadcast dialogs, leaving the server URL
empty selects this transport.

::: warning Input is sanitized
Room ids, user names, avatar URLs, cursor positions, and presence data pass through sanitization in
the collaboration layer (`collaboration-helpers.ts`). Keep `roomId` to alphanumerics, hyphens, and
underscores to avoid surprises.
:::

## Controlling sessions: Share/Broadcast dialog events

Collaboration is **controlled** by the host app, same as React/Vue. The viewer's Share and Broadcast
dialogs report intent via outputs; you flip the `collaboration` input in response.

| Output/Input         | Type                                        | Purpose                                                                                                  |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `startCollaboration` | `output<CollaborationConfig>`               | User started a session from the Share/Broadcast dialog - set the `collaboration` input with this config. |
| `stopCollaboration`  | `output<void>`                              | User stopped the session - clear the `collaboration` input.                                              |
| `shareDefaults`      | `input<{ roomId?; userName?; serverUrl? }>` | Pre-fills the Share dialog fields; falls back to `authorName` for `userName`, empty otherwise.           |

```ts
@Component({
	template: `
		<pptx-viewer
			[content]="content"
			[canEdit]="true"
			[collaboration]="collab()"
			[shareDefaults]="{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }"
			(startCollaboration)="collab.set($event)"
			(stopCollaboration)="collab.set(undefined)"
		/>
	`,
})
export class CollaborativeEditorComponent {
	readonly collab = signal<CollaborationConfig | undefined>(undefined);
}
```

## Presence and remote cursors

While a session is active the viewer renders:

- **Remote cursors** on the slide canvas (`CollaborationCursorsComponent`), each labelled with the
  user's name and colour.
- **Remote selection highlights** (`RemoteSelectionOverlayComponent`) around elements another peer
  has selected.
- A **follow-mode banner** (`FollowModeBarComponent`) letting the local user follow a peer's active
  slide.

Presence data is broadcast via Yjs _awareness_. Each participant publishes a presence record
(client id, name, colour, active slide index, clamped cursor X/Y, selected element id, role,
last-updated timestamp), which drives the cursor and presence UI.

## Building custom collaboration UI

The collaboration service and components are exported from the package root (there is no separate
subpath the way `pptx-react-viewer/viewer` has one) if you want to drive sync or render your own
presence UI:

```ts
import {
	CollaborationService,
	CollaborationCursorsComponent,
	RemoteSelectionOverlayComponent,
	FollowModeBarComponent,
} from 'pptx-angular-viewer';
import type { CollaborationConfig, RemoteCursor, RemotePresence } from 'pptx-angular-viewer';
```

`CollaborationService` exposes `status`, `connected`, `active`, `activeRole`, `presence`, `cursors`,
and `connectedCount` as signals, plus `connect()`, `retry()`, `disconnect()`, `broadcastSlides()`,
`setCursor()`, `setSelection()`, `setActiveSlide()`, and `followUser()` methods. See
[Services › Complete Services Reference](/angular/services-reference#collaboration-internals) for
the full set of lower-level collaboration building blocks (`LocalPresencePublisher`,
`createWebsocketBundle`/`createWebrtcBundle`, `WriteBackScheduler`).

## Server side

With the default `websocket` transport you need a running `y-websocket`-compatible relay reachable
at `serverUrl`. Two production-shaped reference servers ship in `demos/` and are shared across all
three bindings (React, Vue, Angular all speak the same sync schema):

- **`demos/collab-server.example.mjs`** - zero-dependency Bun server (uses the repo's existing
  `yjs` / `y-protocols` / `lib0`). Auth has two modes, both validated at the websocket handshake
  (401 before upgrade):

  - **JWT mode** (production): set `COLLAB_AUTH_JWT_SECRET` and have your app server mint
    short-lived HS256 tokens.
  - **Allowlist mode** (dev): `COLLAB_AUTH_TOKENS=a,b,c` static tokens.

  A `role: 'viewer'` token gets a **read-only connection**: the relay drops its document writes, so
  read-only is enforced server-side rather than trusting client-side `canEdit`. Each room's Y.Doc is
  snapshotted to `COLLAB_DATA_DIR` and restored on the next join, so documents survive restarts.

  ```bash
  COLLAB_AUTH_JWT_SECRET=change-me bun demos/collab-server.example.mjs
  ```

- **`demos/collab-server-hocuspocus.example.mjs`** - the same contract on a Node/Hocuspocus stack
  (SQLite persistence via `@hocuspocus/extension-sqlite`).

Both validate the token every binding sends: `authToken` in `CollaborationConfig` becomes the
`?token=` query parameter on the websocket handshake. In production, terminate TLS in front of the
relay (`wss://`) and prefer the JWT mode with short TTLs.

With `transport: 'webrtc'` no document server is required.

The MCP package ships its own server-side Yjs codec ([/packages/mcp](/packages/mcp)); note its Y.Doc
key layout differs from the viewer bindings' sync schema, so the two cannot share one Y.Doc.
