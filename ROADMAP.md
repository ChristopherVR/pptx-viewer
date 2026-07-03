# Roadmap: mobile-first support & collaboration

Tracked work items distilled from the mobile and collaboration audits. Each item
notes scope, the per-framework status, and the reference implementation to port
from. React (`packages/react`) is the reference; Vue and Angular are ports.

Status legend: ✅ done · 🟡 partial · ❌ missing.

Progress: M1-M5 and C1-C4 are shipped across React, Vue, and Angular. Of C3
(collaboration hardening), granular CRDT merging, elected-writer write-back,
and a serverless transport are done; server-side auth + persistence remain a
deployment concern (see `demos/collab-server-hocuspocus.example.mjs`).

## Mobile / touch

### M1. Vue mobile editing chrome (priority)

Vue has editing and a generic `MobileSheet`, but no mobile toolbar or menus, so
on a phone the desktop ribbon is hidden (`max-md:hidden`) and Insert/Format/
Design/File are unreachable. Port React's mobile chrome to Vue:
`MobileToolbar`, `MobileMenuSheet`, `MobileSlidesSheet`, `MobileChromeOverlay`,
`MobileBottomBar` (edit actions, not just nav).

- React ref: `packages/react/src/viewer/components/mobile/*`
- React 🟡(reference) · Vue ❌ · Angular ✅

### M2. Responsive mobile dialogs

Dialogs are swipe-dismissable but still centered/fixed-width; on small phones
they are cramped. Make them adapt (full-width / bottom-sheet) under the mobile
breakpoint across all bindings (React per-dialog or a shared shell; Vue/Angular
via the shared `ModalDialog`).

- React 🟡 · Vue 🟡 · Angular 🟡

### M3. Mobile presenter view

`PresenterView` assumes dual-screen. Add a phone-adapted presenter layout
(current + next, notes, timer) or a clear mobile fallback.

- React ❌ · Vue ❌ · Angular ❌

### M4. Virtual-keyboard layout reflow

The on-screen keyboard is detected (`isVirtualKeyboardOpen`) but nothing reflows;
it can cover the canvas or bottom bar. Adjust chrome / scroll the active edit
target into view when the keyboard opens.

- React 🟡 · Vue 🟡 · Angular 🟡

### M5. Mobile export progress UX

PNG/PDF/GIF/video export has no progress/streaming affordance; large exports can
appear to stall on a phone. Add progress + cancel on mobile.

- React 🟡 · Vue 🟡 · Angular 🟡

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
last-write-wins), origin-tagged transactions for echo suppression, and
elected-writer (`role: 'owner'`) PPTX write-back wired in all bindings.
Remaining (deployment concern, not library code): server-side auth +
persistence for self-hosted relays (see
`demos/collab-server-hocuspocus.example.mjs`), and character-level merging of
concurrent edits to the SAME text run (currently per-element granularity).

- Cross-cutting · library-side done, server-side is per-deployment.

### C4. Serverless (static-host) collaboration transport

`transport: 'webrtc'` (y-webrtc) in all three bindings: leaving the server URL
empty in the Share/Broadcast dialogs starts a peer-to-peer session. Tabs in the
same browser connect via BroadcastChannel with no infrastructure at all (this
is what the GitHub Pages demos use); cross-device peers meet through WebRTC
signaling servers (`signaling` config / `?signaling=` demo URL param).

- React ✅ · Vue ✅ · Angular ✅
