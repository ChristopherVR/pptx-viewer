# Roadmap: mobile-first support & collaboration

Tracked work items distilled from the mobile and collaboration audits. Each item
notes scope, the per-framework status, and the reference implementation to port
from. React (`packages/react`) is the reference; Vue and Angular are ports.

Status legend: ✅ done · 🟡 partial · ❌ missing.

Progress: M1-M5 and C1-C4 are shipped across React, Vue, and Angular,
including character-level merging of concurrent edits to the same text run and
reference relay servers with token auth + persistence (C3). Nothing on this
roadmap remains open; wiring a production credential backend (JWT / session
validation) into the reference servers is inherently per-deployment.

## Mobile / touch

### M1. Vue mobile editing chrome

Mobile chrome (toolbar, menu/slides sheets, chrome overlay, bottom bar with
edit actions) is ported to all bindings; Insert/Format/Design/File are
reachable on phones everywhere.

- React ref: `packages/react/src/viewer/components/mobile/*`
- React ✅ · Vue ✅ · Angular ✅

### M2. Responsive mobile dialogs

Dialogs adapt (full-width / bottom-sheet) under the mobile breakpoint across
all bindings (React via `MobileDismissSheet` + per-dialog handling, Vue/Angular
via the shared `ModalDialog` shell).

- React ✅ · Vue ✅ · Angular ✅

### M3. Mobile presenter view

Phone-adapted presenter layout (current + next, notes, timer) shipped as
`MobilePresenterView` in all three bindings.

- React ✅ · Vue ✅ · Angular ✅

### M4. Virtual-keyboard layout reflow

Keyboard insets are tracked (shared `mobile-keyboard.ts`, per-binding
`useKeyboardInsets` equivalents) and chrome reflows / the active edit target
scrolls into view when the on-screen keyboard opens.

- React ✅ · Vue ✅ · Angular ✅

### M5. Mobile export progress UX

PNG/PDF/GIF/video export reports progress with cancel support (shared
`export-progress.ts`, `ExportProgressModal` equivalents per binding).

- React ✅ · Vue ✅ · Angular ✅

## Collaboration

### C1. Vue collaboration port

Provider, document sync, presence, remote cursors, selection overlay, follow
mode, and status indicator are ported; the awareness wire format matches the
React/Angular nested `presence` schema so cross-framework sessions interop.

- React ref: `packages/react/src/viewer/hooks/collaboration/*`,
  `packages/react/src/viewer/components/collaboration/*`
- React ✅ · Vue ✅ · Angular ✅

### C2. Angular collaboration dialog UIs

Share/Broadcast dialogs are wired to `CollaborationService`, and the component
now drives the service end-to-end: document sync both ways, cursor + selection
publishing, remote selection overlay, follow mode, connect timeout/retry.

- React ✅ · Vue ✅ · Angular ✅

### C3. Collaboration hardening

Done: granular per-slide/element/field CRDT reconciliation
(`reconcileSlidesInYDoc` in `pptx-viewer-shared`, replacing whole-array
last-write-wins), origin-tagged transactions for echo suppression,
elected-writer (`role: 'owner'`) PPTX write-back wired in all bindings, and
character-level merging of concurrent edits to the same text run
(`collaboration-text-merge.ts`: minimal in-place Y.Text diffs instead of
per-element replacement, so simultaneous typing in one text box converges).
Server-side auth + persistence: two reference relays ship in `demos/` -
`collab-server.example.mjs` (zero-dependency Bun server; `?token=` allowlist
auth enforced at the websocket handshake, per-room Y.Doc snapshots restored
across restarts; verified end-to-end against the y-websocket clients) and
`collab-server-hocuspocus.example.mjs` (same contract on Node/Hocuspocus with
SQLite persistence). Swapping the token allowlist for a real credential
backend (JWT / session lookup) is per-deployment by nature.

- Cross-cutting · ✅ done (credential backends are per-deployment).

### C4. Serverless (static-host) collaboration transport

`transport: 'webrtc'` (y-webrtc) in all three bindings: leaving the server URL
empty in the Share/Broadcast dialogs starts a peer-to-peer session. Tabs in the
same browser connect via BroadcastChannel with no infrastructure at all (this
is what the GitHub Pages demos use); cross-device peers meet through WebRTC
signaling servers (`signaling` config / `?signaling=` demo URL param).

- React ✅ · Vue ✅ · Angular ✅
