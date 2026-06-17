---
title: Collaboration
description: Real-time multi-user co-editing for PowerPointViewer via Yjs CRDT - the collaboration prop, CollaborationConfig shape, presence, and remote cursors.
---

# Collaboration

`PowerPointViewer` supports real-time, multi-user editing built on **Yjs** (a CRDT) with WebSocket
transport. When enabled, it adds CRDT-based document sync, live remote cursors, user presence
indicators, and avatars. In single-user mode none of this is loaded.

::: info Optional dependencies
Collaboration requires the `yjs` and `y-websocket` peer dependencies. The viewer works fully without
them - it simply runs single-user. Install them only when you need co-editing:

```bash
npm i yjs y-websocket
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
type CollaborationRole = 'collaborator' | 'broadcaster' | 'viewer';

interface CollaborationConfig {
	/** Unique room id (alphanumeric, hyphens, underscores). */
	roomId: string;
	/** WebSocket URL for the Yjs provider, e.g. "wss://collab.example.com". */
	serverUrl: string;
	/** Display name for the local user. */
	userName: string;
	/** Avatar URL for the local user (optional). */
	userAvatar?: string;
	/** Hex colour for the local user's cursor / presence indicator. */
	userColor?: string;
	/** Optional auth token sent with the WebSocket handshake. */
	authToken?: string;
	/** Session role - defaults to 'collaborator'. */
	role?: CollaborationRole;
}
```

| Field        | Type                | Required | Notes                                                                                         |
| ------------ | ------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `roomId`     | `string`            | yes      | Sanitized; restrict to alphanumeric / `-` / `_`.                                              |
| `serverUrl`  | `string`            | yes      | `y-websocket` server URL.                                                                     |
| `userName`   | `string`            | yes      | Local user's display name; also used as comment/annotation author when `authorName` is unset. |
| `userAvatar` | `string`            | no       | Validated avatar URL.                                                                         |
| `userColor`  | `string`            | no       | Hex colour for the user's cursor ring.                                                        |
| `authToken`  | `string`            | no       | Sent with the WebSocket handshake.                                                            |
| `role`       | `CollaborationRole` | no       | `'collaborator'` (default), `'broadcaster'`, or `'viewer'`.                                   |

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

You need a running `y-websocket` server (or compatible Yjs provider) reachable at `serverUrl`. For
the server-side document codec used to encode/decode the shared PPTX state, see the MCP package at
[/packages/mcp](/packages/mcp).
