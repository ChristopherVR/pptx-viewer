---
title: Collaboration
description: Real-time multi-user co-editing for PowerPointViewerComponent via Yjs CRDT - the collaboration input, CollaborationConfig shape, presence, and remote cursors.
---

# Collaboration

For an existing application-owned Yjs provider, use `collaboration.externalSession`.
See [Host-owned collaboration](/guide/host-owned-collaboration) for the shared contract.

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

For a custom editor shell, use `ViewerCollaborationShellService` alongside
`POWER_POINT_VIEWER_PROVIDERS`. It composes the existing loader, editor, session,
canvas-editing, and cursor services; it does not create a second collaboration
controller or transport. Call `bind()` once from the host component constructor
with reactive accessors:

```ts
import { Component, inject, input, viewChild } from '@angular/core';
import {
	POWER_POINT_VIEWER_PROVIDERS,
	SlideCanvasComponent,
	ViewerCollaborationShellService,
} from 'pptx-angular-viewer';
import type {
	CollaborationConfig,
	CollaborationShellState,
	ViewerCollaborationShellOptions,
} from 'pptx-angular-viewer';

@Component({
	selector: 'app-custom-slides',
	standalone: true,
	providers: [...POWER_POINT_VIEWER_PROVIDERS, ViewerCollaborationShellService],
	imports: [SlideCanvasComponent],
	template: `
		<pptx-slide-canvas
			[slide]="shell.activeSlide()"
			[canvasSize]="shell.loader.canvasSize()"
			[mediaDataUrls]="shell.loader.mediaDataUrls()"
			[templateElements]="shell.activeTemplateElements()"
			[editable]="shell.canEdit()"
			[selectedIds]="shell.editor.selectedIds()"
			[editingId]="shell.canvasEditing.editingId()"
			(elementSelect)="shell.canvasEditing.onElementSelect($event)"
			(textEditStart)="shell.canvasEditing.onTextEditStart($event.id)"
			(textInput)="shell.canvasEditing.onTextInput($event)"
			(textCommit)="shell.canvasEditing.onTextCommit($event)"
			(textCancel)="shell.canvasEditing.editingId.set(null)"
			(listSession)="shell.canvasEditing.onListSession($event)"
		/>
	`,
})
export class CustomSlidesComponent {
	readonly content = input<Uint8Array | null>(null);
	readonly collaboration = input<CollaborationConfig>();
	readonly canEdit = input(true);
	readonly shell = inject(ViewerCollaborationShellService);
	readonly canvas = viewChild(SlideCanvasComponent);

	constructor() {
		const options: ViewerCollaborationShellOptions = {
			content: this.content,
			collaboration: this.collaboration,
			canEdit: this.canEdit,
			stageElement: () => this.canvas()?.getStageElement(),
		};
		this.shell.bind(options);
	}

	getState(): CollaborationShellState {
		return this.shell.state();
	}
	getContent(): Promise<Uint8Array> {
		return this.shell.getContent();
	}
}
```

The example wires text editing; connect the canvas transform, table, and other
outputs for the operations your shell exposes. Gate custom mutation controls with
`shell.canEdit()`, not just the requested host permission. Save rejects unfinished
native input or IME composition instead of serializing an older text snapshot.
The effective gate also
accounts for the active session's role/readiness and a real source still loading
or failing to load. A blank editor without collaboration retains its ordinary
host-controlled permission. `getContent()` saves the current editable model even
when a viewer role or a paused session disables editing.

`shell.state()` exposes normalized `remoteUsers`, connection `status`, and
`connectedCount`. For canvas presence, forward pointer movement to
`shell.cursor.onPointerMove($event)` and project `CollaborationCursorsComponent`
and `RemoteSelectionOverlayComponent` **inside** `SlideCanvasComponent`. Supply
`shell.cursor.cursors()`, `shell.collaboration.presence()`, the active slide's
elements, and `shell.activeSlideIndex()`. Both overlays use unscaled slide
coordinates; the canvas applies zoom once. `getStageElement()` supplies the actual
scaled slide origin without depending on internal CSS selectors.

See `demos/demo-angular/src/host-owned-headless-editor.component.ts` for a runnable
custom shell with text and shape editing, save, zoom, and both presence overlays.
The [host-owned collaboration contract](/guide/host-owned-collaboration) and its
same-textbox concurrency limitations apply equally to custom and full-viewer UI.

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
five bindings (React, Vue, Angular, Svelte and vanilla all speak the same sync schema):

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
