---
title: Svelte Viewer Collaboration
description: Real-time multi-user co-editing for the Svelte PowerPointViewer via Yjs CRDT - the collaboration prop, CollaborationConfig shape, Share/Broadcast dialogs, presence, and remote cursors.
---

# Collaboration

`<PowerPointViewer>` supports real-time, multi-user editing built on **Yjs** (a CRDT) with
either a WebSocket transport (`y-websocket`, needs a server) or a serverless peer-to-peer
transport (`y-webrtc`). The `CollaborationConfig` type and wire format are shared with the
React, Vue, Angular, and Vanilla bindings (defined once in the shared layer), so all bindings
interoperate in the same room. When enabled, the viewer connects to the room, publishes local
edits granularly (per slide / element), applies remote peers' edits, and renders live remote
cursors, selection highlights, and user presence. In single-user mode none of this is loaded.

::: info Optional dependencies
Collaboration needs `yjs` plus the provider for your transport; both are loaded via dynamic
import only when a session starts:

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## Enabling it: the `collaboration` prop

Pass a `CollaborationConfig` to the `collaboration` prop. Clearing it (setting `undefined`)
tears the session down. A `viewer` role makes the local user read-only.

```svelte
<script lang="ts">
	import { PowerPointViewer, type CollaborationConfig } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();

	const config: CollaborationConfig = {
		roomId: 'my-room-123',
		serverUrl: 'wss://collab.example.com',
		userName: 'Alice',
		userColor: '#6366f1',
	};
</script>

<PowerPointViewer source={bytes} editable collaboration={config} />
```

## `CollaborationConfig`

| Field                 | Type                          | Required | Notes                                                                                                     |
| --------------------- | ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `roomId`              | `string`                      | yes      | Room identifier; keep to alphanumerics, hyphens, underscores.                                             |
| `serverUrl`           | `string`                      | yes      | `y-websocket` server URL; may be `''` when `transport: 'webrtc'`.                                         |
| `transport`           | `'websocket' \| 'webrtc'`     | no       | `'websocket'` (default) or `'webrtc'` (serverless P2P).                                                   |
| `signaling`           | `string[]`                    | no       | y-webrtc signaling URLs; defaults to y-webrtc's public list.                                              |
| `userName`            | `string`                      | yes      | Local user's display name.                                                                                |
| `userAvatar`          | `string`                      | no       | Avatar URL for the local user.                                                                            |
| `userColor`           | `string`                      | no       | Hex colour for the user's cursor/presence indicator.                                                      |
| `authToken`           | `string`                      | no       | Sent with the WebSocket handshake / used as the webrtc room password.                                     |
| `role`                | `CollaborationRole`           | no       | `'owner'`, `'collaborator'` (default), or `'viewer'` (read-only).                                         |
| `sessionIntent`       | `'create' \| 'join'`          | no       | Whether this client created or joined the room; hosts can use it to avoid publishing local bytes on join. |
| `onWriteBack`         | `(bytes: Uint8Array) => void` | no       | Elected-writer persistence: only the `'owner'` peer receives debounced serialized PPTX snapshots.         |
| `writeBackDebounceMs` | `number`                      | no       | Debounce between the last change and `onWriteBack`. Default 5000 ms.                                      |

### Serverless peer-to-peer mode

With `transport: 'webrtc'` no document server is needed: peers exchange updates directly over
WebRTC, and tabs in the **same browser** connect through BroadcastChannel even with no network
at all. Cross-device sessions meet through WebRTC signaling servers (metadata only; document
data never passes through them); supply your own via `signaling` for production use. In the
built-in Share/Broadcast dialogs, leaving the server URL empty selects this transport.

## Controlling sessions: Share and Broadcast dialogs

Collaboration is **controlled by the host app**. The built-in Share dialog (and the one-way
Broadcast flow, where viewers follow the presenter's active slide) reports intent via
callbacks; you flip the `collaboration` prop in response:

| Callback               | Payload                       | Purpose                                                                    |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `onstartcollaboration` | `config: CollaborationConfig` | The user started a session; set the `collaboration` prop with this config. |
| `onstopcollaboration`  | -                             | The user stopped the session; clear the `collaboration` prop.              |

`shareDefaults` (`{ roomId?, userName?, serverUrl? }`) pre-fills the Share dialog's form; the
Broadcast dialog reuses its `serverUrl`. Every field stays user-editable.

```svelte
<script lang="ts">
	import { PowerPointViewer, type CollaborationConfig } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let collab = $state<CollaborationConfig | undefined>();
</script>

<PowerPointViewer
	source={bytes}
	editable
	collaboration={collab}
	shareDefaults={{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }}
	onstartcollaboration={(config) => (collab = config)}
	onstopcollaboration={() => (collab = undefined)}
/>
```

::: tip Hiding the entry points
For a read-only embed with no collaboration UI, hide the toolbar buttons with
`hiddenActions={['share', 'broadcast']}`. See
[Component Props](/svelte/props#hiddenactions-values).
:::

## Presence and remote cursors

While a session is active the viewer renders remote cursors on the slide canvas (labelled with
each user's name and colour), highlights remote selections, shows a connection status
indicator, and offers a follow-mode bar. Presence travels over Yjs _awareness_: each
participant publishes a record (name, colour, active slide, cursor position, selected element,
role) that drives the cursor UI.

::: warning Input is sanitized
Room ids, user names, avatar URLs, cursor positions, and presence data pass through
sanitization in the collaboration layer. Keep `roomId` to alphanumerics, hyphens, and
underscores to avoid surprises.
:::

## Server side

With the default `websocket` transport you need a `y-websocket`-compatible relay reachable at
`serverUrl`. Because the wire format is shared across bindings, the repository's reference
servers work unchanged: `demos/collab-server.example.mjs` (zero-dependency Bun relay with JWT
or token-allowlist auth and per-room persistence) and
`demos/collab-server-hocuspocus.example.mjs` (the same contract on Node/Hocuspocus with SQLite
persistence). See [the Vue collaboration page](/vue/collaboration#server-side) for the full
server setup and auth details; everything there applies to this binding as-is.

With `transport: 'webrtc'` no document server is required.
