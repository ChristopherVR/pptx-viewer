# C3: collaboration hardening

Design proposal and implementation status for roadmap item C3. Addresses three
weaknesses in the real-time collaboration stack.

## Implementation status (as of 2026-06-21)

- **Area 1 (structural CRDT)**: DONE. `pptx:slides` is a `Y.Array` of slide
  `Y.Map`s; each element has a `Y.Map` with scalar fields, JSON blobs for
  complex data, and a `Y.Text` (`textBody`) for text segments. Schema defined in
  `packages/shared/src/render/collaboration-sync.ts` and mirrored in
  `packages/tools/src/codec/pptx-codec.ts`. All three bindings (React, Vue,
  Angular) use the shared `writeSlidesToYDoc` / `readSlidesFromYDoc` /
  `observeYDocSlides` helpers. Fidelity test in `packages/tools/src/__tests__/codec/pptx-codec.test.ts`.
- **Area 2 (server auth)**: DONE (doc + example). Contract documented in
  `docs/COLLAB-PRODUCTION.md`. Hocuspocus example in
  `demos/collab-server-hocuspocus.example.mjs`. Token/room/identity contract
  is clear; the reference demo server is explicitly labelled as demo-grade.
- **Area 3 (elected writer write-back)**: DONE. When `config.role === 'owner'`,
  the composable/service debounces Y.Doc changes (default 5 s, configurable via
  `writeBackDebounceMs`) and calls `config.onWriteBack(bytes)` with serialized
  PPTX bytes. Implemented in `useYjsDocumentSync` (React), `useCollaboration`
  (Vue), and `CollaborationService` (Angular).

---

## Original proposal

## Where we are today

- Transport/CRDT: Yjs + `y-websocket`, lazily imported. Provider in each binding
  (`useYjsProvider` / Angular `CollaborationService`), presence via Yjs awareness
  (`usePresenceTracking`, sanitised in `sanitize.ts` / shared `collaboration-presence`).
- Document model: `PptxCodec` (`packages/tools/src/codec/pptx-codec.ts`) maps the
  deck into Yjs: `pptx:slides` is a `Y.Array` of slide `Y.Map`s; scalar fields are
  native, but complex fields (textSegments, shapeStyle, tableData, animations,
  transition, comments) are stored as JSON strings under `_`-prefixed keys.
- Server: `demos/demo-react/collab-server.mjs`, a demo-grade reference. Bun
  WebSocket, in-memory rooms, rooms destroyed when empty, an optional
  `POST/GET /file/:roomId` seed endpoint. An `authToken` is accepted but never
  validated. No persistence, no access control, no rate limiting, no scaling.
- Save: collaboration syncs `PptxSlide[]` in the Y.Doc; the `.pptx` save pipeline
  in core runs independently. Edits do not auto-persist; the host must call
  `handler.save(...)`. Two clients saving concurrently is last-save-wins.

## The three weaknesses

1. Conflict granularity: complex fields are monolithic JSON blobs, so Yjs merges
   at the blob boundary. Two people editing the same shape's text (or any one
   complex field) concurrently is last-write-wins with silent loss.
2. Server: no authentication (anyone with the room URL can join and edit; a
   client can claim any user name), no persistence (a restart loses the room).
3. Source of truth: the live Y.Doc and the saved `.pptx` are decoupled, and
   per-client save is last-save-wins. It is ambiguous what is canonical.

---

## Area 1: conflict granularity

| Option | What                                                                                                  | Effort | Result                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| A      | Keep LWW JSON blobs                                                                                   | none   | Same-field concurrent edits lose data silently                                                     |
| B      | Element-granular `Y.Map` (each element field as a separate entry) + elements as a per-slide `Y.Array` | medium | Independent edits merge (move + recolor; add/remove/reorder elements). Same scalar field still LWW |
| C      | Model text bodies as `Y.Text`                                                                         | high   | True concurrent typing in the same text box merges per character                                   |
| D      | B + C together                                                                                        | high   | Full structural + intra-text CRDT                                                                  |

Recommendation: B first. It removes silent loss for the common case (people
editing different elements/properties, or adding/removing/reordering elements
and slides) for a moderate codec refactor. C (Y.Text for runs) is the only way
to get Google-Slides-style concurrent typing in one text box, but mapping the
PPTX paragraph/run/run-property model to Y.Text formatting marks and back is the
hardest single piece; defer unless that exact scenario is required.

Risks: the on-wire Yjs schema changes (existing rooms become incompatible; low
impact since rooms are ephemeral). Codec round-trip fidelity must be guaranteed
for any field not explicitly modeled (keep an opaque passthrough for unmodeled
data); add a load -> hydrate -> dehydrate -> save -> reload equality test.

## Area 2: server auth + persistence

| Option | What                                                                                                                                                      | Effort     | Who owns the server                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| A      | Stay transport-agnostic. Document the contract; the demo server stays a demo                                                                              | low        | The integrator (BYO y-websocket backend) |
| B      | Harden the reference server: pluggable `verifyToken` + pluggable storage adapter (memory default, Redis/Postgres/S3) + basic rate limiting                | large      | Us (we ship a server)                    |
| C      | Recommend an existing server (Hocuspocus: the de-facto y-websocket server with auth/persistence/webhook hooks) and provide a thin example + client config | low-medium | The integrator, using a known server     |

Recommendation: A + C, with a small B-lite. Keep the client transport-agnostic;
document the contract (room = WS path, identity/role via a signed token query
param) and recommend Hocuspocus or a hosted CRDT provider for production. Add
just an optional `verifyToken(token, room)` hook to our reference server so the
demo can show real auth, without us owning persistence or scaling.

Auth model (independent of server choice): the host app mints a short-lived
signed token (JWT) scoped to room + role + user identity; the server verifies
the signature and room claim on the WS upgrade; presence `userName`/`color` are
taken from the verified token, not from client-supplied awareness, to stop
impersonation. Today identity is client-supplied (sanitised but not
authenticated).

## Area 3: Y.Doc vs the .pptx save pipeline

| Option | Canonical store                                                                                 | Write-back                                                  | Tradeoff                                                         |
| ------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| A      | Y.Doc during the session; `.pptx` is an export/snapshot                                         | one coordinated writer serializes on debounce + session end | Cleanest mental model (like Docs); needs a single elected writer |
| B      | `.pptx` file is canonical; Y.Doc is a transient editing layer                                   | coordinated save serializes Y.Doc -> `.pptx`                | Closer to today; still needs one coordinated writer              |
| C      | Y.Doc canonical + periodic authoritative `.pptx` snapshot as durable backup / next-session seed | same as A                                                   | A in practice                                                    |

Recommendation: A/C. During a session the Y.Doc is canonical; a single
coordinated write-back (NOT every client) serializes to `.pptx` on a debounce and
on session end. This eliminates last-save-wins. Two sub-options for who writes:

- Elected client (recommended for the library): the host/presenter client owns
  serialization via core + `handler.save`; the server stays thin. Depends on a
  client being online.
- Server-side: a headless worker runs core to serialize. Robust and
  client-independent, but puts core (and any DOM-dependent rendering concerns)
  on the server.

The host integrates by seeding the room with the initial `.pptx` (already
supported) and receiving serialized bytes on a write-back callback to persist
wherever it stores files.

---

## Phased plan

- Phase 0 (cheap, do first regardless): document the integration contract and
  security caveats. State plainly that the demo server has no auth/persistence,
  define the token/room/identity contract, and point to the recommended
  production path. Add the token-as-identity rule to the client.
- Phase 1: element-granular CRDT + per-slide element `Y.Array` (Area 1 B) and a
  codec round-trip fidelity test. Removes silent data loss for independent edits.
- Phase 2: coordinated `.pptx` write-back, elected-client (Area 3 A). Single
  source of truth, no last-save-wins.
- Phase 3: server auth hook + persistence (Area 2 B-lite + C / Hocuspocus).
- Phase 4 (optional): `Y.Text` text bodies (Area 1 C) for concurrent typing.

## Decisions needed before building

1. Concurrency target: is "independent edits merge, same-text-box is LWW"
   (Phase 1) enough, or do we need true concurrent typing in one text box
   (Phase 4, the expensive Y.Text mapping)?
2. Server stance: stay transport-agnostic and recommend Hocuspocus/hosted (A+C),
   or build and own a hardened server (B)?
3. Write-back: elected-client serialization (thin server) or server-side
   serialization (robust, runs core on the server)?
4. Auth: is host-minted signed tokens the model, and should presence identity be
   derived from the verified token (recommended) rather than client-supplied?
