---
title: Services
description: The service-based architecture of PowerPointViewerComponent, the curated set of public services exported from pptx-angular-viewer, and the full internal set exposed alongside them.
---

# Services

`PowerPointViewerComponent` is a thin, `OnPush`, signal-driven orchestrator. Almost all of its logic
lives in roughly two dozen `@Injectable` **orchestration services** - provided on the component
(`providers: [...]`) and wired together with `inject()` - plus 100+ standalone child components and
plain helper functions. This is Angular's counterpart to React's 67+ custom hooks and Vue's
composables: the same decomposition, expressed through Angular's own idiom (injectable services with
signal-based state instead of hook closures).

::: info Internal vs public vs unstable
Most of these building blocks are **internal architecture**: they assume a specific composition
order (each is `bind()`-wired with accessors from the host component in the constructor) and shared
inputs. Unlike React, Angular's ng-packagr build produces a **single entry point** - there is no
separate `pptx-angular-viewer/hooks-unstable` subpath. A curated subset (listed below) is the
intended public surface; the **complete** set - every service, component, and helper - is also
importable from the same `pptx-angular-viewer` package, but with **no compatibility guarantees**:
see [Complete Services Reference](/angular/services-reference).
:::

## Orchestration services (internal architecture)

These services describe how the viewer is wired. They are importable (see below) but assume the
component's specific `bind()` handoff pattern - treat this table as conceptual reference, not an API
contract.

| Service                                                                                               | Concern                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditorStateService`                                                                                  | Document state: slides, selection, undo/redo history, template elements.                                                                            |
| `LoadContentService`                                                                                  | Parses the `.pptx` buffer on load; owns canvas size, media data URLs, embedded fonts.                                                               |
| `ViewerFileIOService`                                                                                 | File ▸ Open / Save As orchestration, content override, `getContent()`.                                                                              |
| `AutosaveService`                                                                                     | Periodic autosave scheduling and status, writing recovery snapshots to IndexedDB.                                                                   |
| `ViewerZoomService`                                                                                   | Zoom level state (`zoom`, `zoomIn`, `zoomOut`, `zoomReset`, `zoomPercent`).                                                                         |
| `ZoomNavigationService`                                                                               | PowerPoint "Zoom" (summary/section zoom) navigation targets.                                                                                        |
| `ZoomTargetService`                                                                                   | Resolves a Zoom tile's fallback thumbnail info (background/number/section) from the live deck.                                                      |
| `ViewerCanvasEditingService`                                                                          | Canvas editing orchestration: element select, background click, transform, text/ink/table-cell edits.                                               |
| `ViewerInspectorPanelService`                                                                         | Right-rail inspector panel switching (element/slide/comments/signatures/accessibility/selection).                                                   |
| `ViewerFormatPainterService`                                                                          | Format painter + eyedropper tool state.                                                                                                             |
| `ViewerFindReplaceService`                                                                            | Find and Find & Replace bar state and search/replace operations.                                                                                    |
| `ViewerKeyboardService`                                                                               | Keyboard shortcut dispatch for the component's document-level keydown listener.                                                                     |
| `ViewerTouchGesturesService`                                                                          | Pinch-zoom, swipe-navigation, and long-press gesture wiring on the canvas host.                                                                     |
| `ViewerMobileSheetService`                                                                            | Mobile bottom-sheet state (slides/menu/notes) and quick-insert action.                                                                              |
| `ViewerPresentationModeService`                                                                       | Presentation-mode orchestration: enter/exit, presenter view, audience window.                                                                       |
| `ViewerCustomShowsService`                                                                            | Custom-show (subset-of-slides presentation) state and presentation slide selection.                                                                 |
| `ViewerDocumentPropertiesService`                                                                     | Document Info dialog and hyperlink dialog state.                                                                                                    |
| `ViewerThemeGalleryService`                                                                           | Theme gallery dialog state and applying a theme preset.                                                                                             |
| `ViewerExportService`                                                                                 | PNG / PDF / GIF / video export and print orchestration, with progress reporting and cancellation.                                                   |
| `CollaborationService`                                                                                | Yjs CRDT connection, sync, and presence for a session.                                                                                              |
| `ViewerCollaborationSessionService`                                                                   | Share/Broadcast dialog state and session connect/disconnect orchestration.                                                                          |
| `ViewerCollabCursorService`                                                                           | Local pointer tracking for broadcasting the user's cursor position.                                                                                 |
| `TableSelectionService`                                                                               | Table cell selection state for the table editor.                                                                                                    |
| `EmbeddedFontsService`                                                                                | Injects a presentation's embedded fonts as managed `@font-face` rules.                                                                              |
| `AccessibilityService`, `PrintService`, `IsMobileService`, `SmartArt3DService`, `FieldContextService` | Accessibility issue scanning, print jobs, device/viewport classification, the opt-in 3D SmartArt gate, and field/placeholder context, respectively. |

There are more still (ink drawing, ruler guides, canvas-fit sizing). See the
**[Complete Services Reference](/angular/services-reference)** for the full list, grouped by
concern, and how to import all of them from `pptx-angular-viewer`.

## Public services & components

The following are exported from the package root and safe to import for building custom UI around
the viewer or driving it programmatically:

```ts
import {
	LoadContentService,
	ExportService,
	EditorStateService,
	CollaborationService,
	renderToCanvas,
} from 'pptx-angular-viewer';
```

### Collaboration

For building custom collaboration UIs or driving sync yourself. See
[Collaboration](/angular/collaboration).

| Export                                       | Purpose                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `CollaborationService`                       | Connect/disconnect a Yjs session, presence, cursors, write-back.                         |
| `CollaborationCursorsComponent`              | Renders remote cursors on the slide canvas.                                              |
| `RemoteSelectionOverlayComponent` (unstable) | Renders remote users' element-selection highlights.                                      |
| `collaboration-helpers` exports              | `validateRoomId`, `sanitizeUserName`, `derivePresenceList`, `assignUserColor`, and more. |

### Rendering & renderers

`SlideCanvasComponent`, `ElementRendererComponent`, `ConnectorRendererComponent`,
`TableRendererComponent`, `ChartRendererComponent`, `SmartArtRendererComponent`,
`InkRendererComponent`, `OleRendererComponent`, `Model3DRendererComponent`, `ZoomRendererComponent`,
`EquationRendererComponent` - the per-element-type renderers `SlideCanvasComponent` composes.

### Export

| Export           | Purpose                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `ExportService`  | PNG/PDF/GIF/WebM rasterisation and PDF/GIF/video assembly.                                           |
| `renderToCanvas` | Standalone `html2canvas-pro` wrapper with an oklch-colour workaround. See [Export](/angular/export). |

## Using an internal service directly

If the curated public services above don't cover what you need, every internal service, component,
and helper is also importable in full from `pptx-angular-viewer` itself (there is no separate
subpath):

```ts
import { EditorStateService, ViewerZoomService, buildSaveSlides } from 'pptx-angular-viewer';
```

::: warning No compatibility guarantees
Everything documented on the [Complete Services Reference](/angular/services-reference) page is
re-exported unmodified from the same building blocks `PowerPointViewerComponent` composes
internally. They are not part of the package's semver contract: signatures and behavior can change,
and services/components can be renamed or removed, in **any** release including a patch release.
Prefer the inputs/outputs/[public API](/angular/api) or the curated services above first; reach for
this only for advanced integrations, and pin an exact version if you depend on it.
:::

See the **[Complete Services Reference](/angular/services-reference)** for the full list and
[Overview](/angular/#internal-architecture-services-and-standalone-components) for the broader
architectural picture.
