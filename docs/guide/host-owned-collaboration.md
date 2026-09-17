---
title: Host-owned collaboration
description: Supply an existing Yjs document, awareness and synchronization state without giving the viewer ownership of the transport.
---

# Host-owned collaboration

Use `collaboration.externalSession` when your application already owns authentication,
a Yjs provider, offline storage or a shared connection. React, Vue, Angular, Svelte and
Vanilla accept the same contract. The viewer handles its slide schema and presence;
the host handles connecting, reconnecting, authorization and resource lifetime.

```ts
import type { CollaborationConfig, ExternalCollaborationSession } from 'pptx-react-viewer';

// These resources and the store belong to your application, not to a viewer mount.
const session: ExternalCollaborationSession = {
	doc: hostDocument,
	awareness: hostAwareness,
	getSnapshot: () => connectionStore.getSnapshot(),
	subscribe: (listener) => connectionStore.subscribe(listener),
};

const collaboration: CollaborationConfig = {
	roomId: 'presentation-123',
	serverUrl: '', // Required by the shared config, but unused for an external session.
	userName: 'Alice',
	sessionIntent: 'join',
	externalSession: session,
};
```

Import the types from the package for your framework. Pass `collaboration` to its
usual viewer prop or option. The document must be a real `Y.Doc`; the awareness must
belong to that document. Keep the session object stable and notify subscribers when
`status` or `synced` changes. A subscription returns an unsubscribe function.

The host and viewer must resolve the same Yjs runtime. The viewer leaves Yjs external
to its bundle; deduplicate it in your application if your dependency tree contains
multiple versions. Types from separate Yjs runtime copies cannot safely be mixed.

## Readiness is the host's decision

`getSnapshot()` returns `{ status, synced }`. Status is `connecting`, `connected`,
`disconnected` or `error`. `synced` means the authoritative document is available and
the viewer may publish edits. It is independent of network status:

- Keep `synced: false` while loading or hydrating the shared document. No timeout
  enables writes on the host's behalf.
- Set `synced: true` after initial synchronization. Existing room slides are adopted
  before any local bootstrap deck can be published.
- Keep it true during an offline period if edits may queue in the host's Yjs provider.
- Set it false to suspend publishing and durable write-back during a new sync.

Use `sessionIntent: 'create'` for the participant allowed to seed an empty room, and
`'join'` for participants whose startup deck must not seed it. An explicit File > Open
is still an intentional replacement. Coordinate room creation in the host; this is
not server-side authorization or an election protocol.

## Ownership and persistence

The viewer never creates a second provider, disconnects the host provider, or destroys
the supplied document or awareness. On unmount it removes its listeners and restores
only the presence field it still owns. Unrelated awareness fields and later host writes
are preserved. Use one active slide-presence writer per awareness instance.

The host may persist Yjs updates directly. Alternatively, designate one participant
with `role: 'owner'` and `onWriteBack(bytes)` to receive debounced PPTX snapshots, using
the same source PPTX and save options as the editor. Pending and in-flight snapshots
are cancelled if the session leaves or the host revokes readiness. This callback is
not a durable storage acknowledgment; retries, errors and writer election remain host
responsibilities. Read-only viewer role blocks publication, but the server must enforce
access control independently.

## Integration boundaries

This option changes session ownership, not the existing collaboration data model.
The viewer owns `pptx:slides` and its nested Yjs types. Give all participants the same
source PPTX for package resources, themes and media. Other application data can occupy
separate Yjs keys. Do not independently reconcile complete slide snapshots from the host.

Check the host's message and persistence limits against representative decks, including
the initial document update and `Y.encodeStateAsUpdate(doc)` after editing. A compressed
PPTX file's size is not its Yjs snapshot size: the shared schema also carries parsed XML,
shape/group metadata and asset payloads. Moving images out of the document alone may
not be sufficient. This session API does not add transport chunking or change host limits.

It does not add comments-backend integration, a new local-only undo implementation,
or synchronization for every deck-level field. Validate those workflows separately
before exposing them in a collaborative product. A native PowerPoint reopen is also
a separate fidelity check from two browser peers converging.

## Trying the demos

Start the demo relay (`bun run collab`) and a framework demo, then open:

```text
/?externalSession=1&room=example&sample=1&server=ws://localhost:1234
```

A second participant uses the same room without `sample=1`. The host strip exposes
readiness and editor mount controls while retaining the document and provider. The
demo disables BroadcastChannel so synchronization uses the WebSocket relay.
