---
title: Collaboration
description: Real-time multi-user co-editing for PowerPointViewer via Yjs CRDT - the collaboration prop, CollaborationConfig shape, Share/Broadcast dialogs, presence, and remote cursors.
---

# Collaboration

For an existing application-owned Yjs provider, use `collaboration.externalSession`.
See [Host-owned collaboration](/guide/host-owned-collaboration) for the shared contract.

## Custom host chrome

The public `useCollaboration` composable accepts an optional reactive configuration.
Keep a host-owned Yjs session in a `shallowRef`, or pass a getter, so Vue does not
proxy its document or provider. Replacing the configuration restarts only the
viewer's attachment; clearing it or disposing the component releases that attachment,
not the host's document, awareness or provider.

```ts
import { useCollaboration } from 'pptx-vue-viewer';
import type { CollaborationConfig, CollaborationShellState } from 'pptx-vue-viewer';
import { shallowRef } from 'vue';

const config = shallowRef<CollaborationConfig>();
const collab = useCollaboration({
	slides,
	collaboration: config,
	canEdit: () => hostMayEdit,
	sourcePending: () => Boolean(source) && loading.value,
	sourceError: () => Boolean(source) && Boolean(error.value),
	onRemoteSlides: (next) => {
		slides.value = next;
	},
	loadVersion,
	getLoadOrigin: () => lastLoadOrigin,
	// Optional elected-owner persistence: reuse the full retained loader serializer.
	serialize: () => loader.getContent(),
});
// Read this computed ref for each toolbar render and before each edit operation.
const state: CollaborationShellState = collab.shellState.value;
```

`shellState` combines host permission, canonical session readiness, role and source
load state. It also exposes `status`, sanitized `remoteUsers`, and `connectedCount`.
Use its `canEdit` to gate custom controls and edit handlers; a role alone cannot tell
you whether a host session is synced. Existing manual `start`, `stop` and `retry`
calls remain supported. `loadVersion` must advance after applying a load, and
`getLoadOrigin` distinguishes a bootstrap deck from an explicit user-open operation.

When reusing `loader.getContent()` for elected-owner persistence, also pass
`getPendingInlineEdit` to `useLoadContent`. Read the current
`useInlineEditing.readInlineSnapshot()` and its target slide ID there, while editing
is allowed. Reject Save while `isInlineInputPending()` is true, rather than saving
the older model during unfinished native input or composition. This includes an active draft in a saved snapshot without committing or
closing the editor; otherwise the snapshot only contains the last committed model.

Compose `SlideCanvas`, `SelectionOverlay`, `useElementDrag`, `InlineTextEditor`, `useInlineEditing`, `useLoadContent` and
the editor composables from `pptx-vue-viewer/viewer` for a custom editor. Pass the
current slide ID and `livePatcher` to `InlineTextEditor`. Use `onConnectedSuspend`
to overlay its accepted snapshot locally with the exported `overlayInlineTextSnapshot`,
without creating a history entry or publishing a new edit after permission loss. Do not leave
stale editor DOM mounted across authoritative remote replacement. Render
`CollaborationCursors` and `RemoteSelectionOverlay` in the `SlideCanvas` slot:
that slot is already scaled, so the overlays consume unscaled slide coordinates.
Use `SlideCanvas.getStageElement()` as the public pointer-coordinate origin, and
cancel active drags on readonly transitions or teardown. Publish local cursor
coordinates divided by the stage scale, selection IDs and
the active slide through `setCursor`, `setSelection` and `setActiveSlide`.

The [custom-shell demo source](https://github.com/ChristopherVR/pptx-viewer/blob/main/demos/demo-vue/src/HostOwnedHeadlessEditor.vue)
shows the complete wiring without rendering `PowerPointViewer`.

## Built-in viewer

`PowerPointViewer` supports real-time, multi-user editing built on **Yjs** (a CRDT) with either a
WebSocket transport (`y-websocket`, needs a server) or a serverless peer-to-peer transport
(`y-webrtc`). The `CollaborationConfig` type and wire format are shared with the React and Angular
bindings (defined once in `pptx-viewer-shared`), so all three interoperate in the same room. When
enabled, it adds granular CRDT document sync (per slide / element), live remote cursors, selection
highlights, user presence, and follow mode. In single-user mode none of this is loaded.

::: info Optional dependencies
Collaboration requires the `yjs` dependency plus the provider for your transport: `y-websocket`
(server-based) or `y-webrtc` (peer-to-peer). The viewer works fully without them, it simply runs
single-user. Install them only when you need co-editing:

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## Enabling it: the `collaboration` prop

Pass a `CollaborationConfig` to the `collaboration` prop. When present, the viewer wires up presence
tracking, remote cursors, and CRDT sync internally.

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { CollaborationConfig } from 'pptx-vue-viewer';

const config: CollaborationConfig = {
	roomId: 'my-room-123',
	serverUrl: 'wss://collab.example.com',
	userName: 'Alice',
	userColor: '#6366f1',
};
</script>

<template>
	<PowerPointViewer :content="bytes" can-edit :collaboration="config" />
</template>
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
WebRTC signaling servers (metadata only, document data never passes through them); supply your own
via `signaling` for production use. In the built-in Share/Broadcast dialogs, leaving the server URL
empty selects this transport.

::: warning Input is sanitized
Room ids, user names, avatar URLs, cursor positions, and presence data pass through sanitization in
the collaboration layer. Keep `roomId` to alphanumerics, hyphens, and underscores to avoid surprises.
:::

## Controlling sessions: Share and Broadcast dialogs

Collaboration is **controlled** by the host app. The viewer's Share dialog reports intent via
events; you flip the `collaboration` prop in response.

| Event                  | Payload                       | Purpose                                                                                      |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `@start-collaboration` | `config: CollaborationConfig` | User started a session from the Share dialog, set the `collaboration` prop with this config. |
| `@stop-collaboration`  | -                             | User stopped the session, clear the `collaboration` prop.                                    |

`shareDefaults` (`{ roomId?; userName?; serverUrl? }`) pre-fills the Share dialog fields; empty if
omitted.

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { CollaborationConfig } from 'pptx-vue-viewer';
import { ref } from 'vue';

const content = defineProps<{ content: Uint8Array }>();
const collab = ref<CollaborationConfig>();
</script>

<template>
	<PowerPointViewer
		:content="content"
		can-edit
		:collaboration="collab"
		:share-defaults="{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }"
		@start-collaboration="collab = $event"
		@stop-collaboration="collab = undefined"
	/>
</template>
```

The viewer also has a separate **Broadcast** flow for one-way, viewer-follows-presenter sessions
(the presenter joins with `role: 'owner'`; viewers auto-follow the presenter's active slide via a
shared `broadcasterSlideIndex`). It is driven by the same underlying `useCollaboration` session but
through its own dialog state (internal `useCollaborationWiring` composable), not through additional
public props: it reuses `@start-collaboration` / `@stop-collaboration`.

## Presence and remote cursors

While a session is active the viewer renders remote cursors on the slide canvas (labelled with the
user's name and colour) and tracks presence for connected users (connecting / connected /
disconnected / error). Presence is broadcast via Yjs _awareness_: each participant publishes a
record (client id, name, colour, active slide index, clamped cursor X/Y, selected element id, role,
last-updated timestamp) that drives the cursor UI.

## Building custom collaboration UI

```ts
import {
	CollaborationCursors,
	CollaborationStatusIndicator,
	FollowModeBar,
	RemoteSelectionOverlay,
	useCollaboration,
} from 'pptx-vue-viewer/viewer';
```

These stable exports provide the Vue equivalents of React's collaboration hooks and presence UI.
Use `useCollaboration` for a custom session composition. The presentational components accept the
reactive presence data it returns. The full viewer's Share and Broadcast lifecycle is internal
(`useCollaborationWiring` from `pptx-vue-viewer/internals`) and is not covered by semver.

## Server side

With the default `websocket` transport you need a running `y-websocket`-compatible relay reachable
at `serverUrl`. The same reference servers used by the React and Angular demos work here too, since
the wire format is shared:

- **`demos/collab-server.example.mjs`**, zero-dependency Bun server (uses the repo's existing `yjs` /
  `y-protocols` / `lib0`). Auth has two modes, both validated at the websocket handshake (401 before
  upgrade): a JWT mode (production, `COLLAB_AUTH_JWT_SECRET`, short-lived HS256 tokens with `exp`,
  `room`, `sub`, `role` claims enforced server-side) and an allowlist mode
  (`COLLAB_AUTH_TOKENS=a,b,c`, for dev). A `role: 'viewer'` token gets a read-only connection: the
  relay drops its document writes. Each room's Y.Doc is snapshotted to `COLLAB_DATA_DIR` and restored
  on the next join.

  ```bash
  COLLAB_AUTH_JWT_SECRET=change-me bun demos/collab-server.example.mjs
  ```

- **`demos/collab-server-hocuspocus.example.mjs`**, the same contract on a Node/Hocuspocus stack
  (SQLite persistence via `@hocuspocus/extension-sqlite`).

Both validate the token every binding sends: `authToken` in `CollaborationConfig` becomes the
`?token=` query parameter on the websocket handshake. In production, terminate TLS in front of the
relay (`wss://`) and prefer the JWT mode with short TTLs, tokens travel in the URL query, so keep
them short-lived and avoid logging request URLs upstream.

With `transport: 'webrtc'` no document server is required.

The MCP package ships its own server-side Yjs codec ([/packages/mcp](/packages/mcp)); note its Y.Doc
key layout differs from the viewer bindings' sync schema, so the two cannot share one Y.Doc.
