# Roadmap: mobile-first support & collaboration

Tracked work items distilled from the mobile and collaboration audits. Each item
notes scope, the per-framework status, and the reference implementation to port
from. React (`packages/react`) is the reference; Vue and Angular are ports.

Status legend: ✅ done · 🟡 partial · ❌ missing.

Progress: M1-M5 and C1-C2 are shipped across React, Vue, and Angular. Only C3
(collaboration hardening) remains, gated on a design decision.

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

Vue accepts the `collaboration` prop and emits `start/stop-collaboration` but has
no Yjs wiring. Port React's collaboration: provider, document sync, presence,
remote cursors, status indicator.

- React ref: `packages/react/src/viewer/hooks/collaboration/*`,
  `packages/react/src/viewer/components/collaboration/*`
- React ✅ · Vue ❌ · Angular 🟡

### C2. Angular collaboration dialog UIs

`CollaborationService` + cursors exist, but the Share/Broadcast dialog UIs to
start/join a session are not fully wired.

- React ✅ · Vue ❌ · Angular 🟡

### C3. Collaboration hardening (design needed)

Per-field CRDT instead of last-write-wins JSON blobs; server auth + persistence
(the demo server has neither); reconcile the Y.Doc with the `.pptx` save
pipeline. Larger design effort, not auto-started.

- Cross-cutting · needs a design decision first.
