---
title: Collaboration
description: Real-time multi-user co-editing for PowerPointViewer via Yjs CRDT - the collaboration prop, CollaborationConfig shape, presence, and remote cursors.
---

# Collaboration

`PowerPointViewer` supports real-time, multi-user editing built on **Yjs** (a CRDT) with either a
WebSocket transport (`y-websocket`, needs a server) or a serverless peer-to-peer transport
(`y-webrtc`). When enabled, it adds granular CRDT document sync (per slide / element / field), live
remote cursors, selection highlights, user presence indicators, avatars, and follow mode. In
single-user mode none of this is loaded.

::: info Optional dependencies
Collaboration requires the `yjs` dependency plus the provider for your transport: `y-websocket`
(server-based) or `y-webrtc` (peer-to-peer). The viewer works fully without them - it simply runs
single-user. Install them only when you need co-editing:

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## Enabling it: the `collaboration` prop

Pass a `CollaborationConfig` to the `collaboration` prop. When present, the viewer wraps its content
in a collaboration provider and wires up presence tracking, remote cursors, and CRDT sync.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { CollaborationConfig } from 'pptx-react-viewer/viewer';

const config: CollaborationConfig = {
	roomId: 'my-room-123',
	serverUrl: 'wss://collab.example.com',
	userName: 'Alice',
	userColor: '#6366f1',
};

<PowerPointViewer content={bytes} canEdit collaboration={config} />;
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
the collaboration layer. Keep `roomId` to alphanumerics, hyphens, and underscores to avoid surprises.
:::

## Controlling sessions: Share dialog props

Collaboration is **controlled** by the host app. The viewer's Share dialog reports intent; you flip
the `collaboration` prop in response.

| Prop                   | Type                                    | Purpose                                                                                       |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `onStartCollaboration` | `(config: CollaborationConfig) => void` | User started a session from the Share dialog - set the `collaboration` prop with this config. |
| `onStopCollaboration`  | `() => void`                            | User stopped the session - clear the `collaboration` prop.                                    |
| `shareDefaults`        | `{ roomId?; userName?; serverUrl? }`    | Pre-fills the Share dialog fields; empty if omitted.                                          |

```tsx
function CollaborativeEditor({ content }: { content: Uint8Array }) {
	const [collab, setCollab] = useState<CollaborationConfig | undefined>();

	return (
		<PowerPointViewer
			content={content}
			canEdit
			collaboration={collab}
			shareDefaults={{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }}
			onStartCollaboration={setCollab}
			onStopCollaboration={() => setCollab(undefined)}
		/>
	);
}
```

## Presence and remote cursors

While a session is active the viewer renders:

- **Remote cursors** on the slide canvas, each labelled with the user's name and colour.
- **Presence / avatars** for connected users, with connection status (connecting / connected /
  disconnected / error).

Presence data is broadcast via Yjs _awareness_. Each participant publishes a `UserPresence` record
(client id, name, colour, active slide index, clamped cursor X/Y, selected element id, role,
last-updated timestamp), which drives the cursor and avatar UI.

## Building custom collaboration UI

The collaboration hooks and components are exported from `pptx-viewer/viewer` (opt-in,
tree-shakeable) if you want to drive sync or render your own presence UI:

```tsx
import {
	useYjsProvider,
	usePresenceTracking,
	useCollaborativeState,
	useCollaborativeHistory,
	CollaborationProvider,
	RemoteUserCursors,
	UserAvatarBar,
	CollaborationStatusIndicator,
} from 'pptx-react-viewer/viewer';
import type {
	CollaborationConfig,
	CollaborationContextValue,
	UserPresence,
	ConnectionStatus,
	CollaborationRole,
} from 'pptx-react-viewer/viewer';
```

See [Hooks › Collaboration hooks](/react/hooks#collaboration-hooks) for the hook surface.

## Server side

With the default `websocket` transport you need a running `y-websocket`-compatible relay reachable
at `serverUrl`. Two production-shaped reference servers ship in `demos/`:

- **`demos/collab-server.example.mjs`** - zero-dependency Bun server (uses the repo's existing
  `yjs` / `y-protocols` / `lib0`). Token auth: set `COLLAB_AUTH_TOKENS=a,b,c` and connections whose
  `authToken` is not in the allowlist are rejected with 401 at the websocket handshake. File
  persistence: each room's Y.Doc is snapshotted to `COLLAB_DATA_DIR` (debounced plus on last
  disconnect) and restored on the next join, so documents survive server restarts.

  ```bash
  COLLAB_AUTH_TOKENS=secret bun demos/collab-server.example.mjs
  ```

- **`demos/collab-server-hocuspocus.example.mjs`** - the same contract on a Node/Hocuspocus stack
  (SQLite persistence via `@hocuspocus/extension-sqlite`, plus its extension ecosystem for Redis
  scaling, webhooks, database stores). Note that plain y-websocket clients never trigger
  Hocuspocus' `onAuthenticate`; the example validates the `?token=` request parameter in
  `onConnect` instead.

Both validate the token every binding sends: `authToken` in `CollaborationConfig` becomes the
`?token=` query parameter on the websocket handshake. In production, terminate TLS in front of the
relay (`wss://`) and swap the static allowlist for short-lived per-user tokens (JWT / session
lookup) minted by your app server.

With `transport: 'webrtc'` no document server is required.

The MCP package ships its own server-side Yjs codec ([/packages/mcp](/packages/mcp)); note its Y.Doc
key layout differs from the viewer bindings' sync schema, so the two cannot share one Y.Doc.
