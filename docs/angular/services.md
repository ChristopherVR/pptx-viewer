---
title: Services
description: The service-based architecture of PowerPointViewerComponent, the curated set of public services exported from pptx-angular-viewer, and the full internal set exposed alongside them.
---

# Services

`PowerPointViewerComponent` is a thin, `OnPush`, signal-driven orchestrator. Almost all of its logic
lives in roughly two dozen `@Injectable` **orchestration services**, provided on the component
(`providers: [...]`) and wired together with `inject()`, plus 100+ standalone child components and
plain helper functions. This is Angular's counterpart to React's 67+ custom hooks and Vue's
composables: the same decomposition, expressed through Angular's own idiom (injectable services with
signal-based state instead of hook closures).

::: info Public vs internal
Most of these building blocks are **internal architecture**: they assume a specific composition
order and shared inputs. A curated subset (listed below) is the intended public surface, exported
from the `pptx-angular-viewer` package root. The **complete** set is importable from the
`pptx-angular-viewer/internals` subpath: internal building blocks that are not covered by semver, so
prefer the stable root exports. (ng-packagr builds this package as a single compilation unit, so
`internals` is an alias over the same bundle rather than an isolated one; the symbols therefore stay
importable from the root too.) See [Complete Services Reference](/angular/services-reference).
:::

## DI setup

All viewer services are declared as plain `@Injectable()` (not `providedIn: 'root'`).
`PowerPointViewerComponent` lists every one of them in its own `providers` array, so each viewer
instance gets its own isolated service tree; two viewers on one page never share state. Nothing is
registered globally and there is no `provide*` bootstrap function to call.

To use a service standalone (outside the viewer component), provide it yourself at whatever scope
fits and inject it:

```ts
import { Component, inject } from '@angular/core';
import { LoadContentService, EditorStateService } from 'pptx-angular-viewer';

@Component({
	selector: 'app-headless-deck',
	standalone: true,
	providers: [LoadContentService, EditorStateService],
	template: `<p>{{ loader.slideCount() }} slides</p>`,
})
export class HeadlessDeckComponent {
	readonly loader = inject(LoadContentService);
	readonly editor = inject(EditorStateService);
}
```

Two flavors exist, and only one is meant for standalone use:

- **Self-contained state services** (`LoadContentService`, `EditorStateService`, `ExportService`,
  `CollaborationService`, `ViewerZoomService`, `IsMobileService`, ...) own their state as signals
  and work anywhere they are provided.
- **`Viewer*` orchestration services** (`ViewerFileIOService`, `ViewerExportService`,
  `ViewerCanvasEditingService`, ...) expect the host component to call `bind(host)` with a set of
  accessors in its constructor and throw (`"...bind() was not called"`) when used without it. They
  are exported for completeness, not for standalone use.

## Orchestration services (internal architecture)

These services describe how the viewer is wired. Treat this table as conceptual reference, not an
API contract.

| Service                                                                                               | Concern                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditorStateService`                                                                                  | Document state: slides, selection, undo/redo history, template elements.                                                                            |
| `LoadContentService`                                                                                  | Parses the `.pptx` buffer on load; owns canvas size, media data URLs, embedded fonts.                                                               |
| `ViewerFileIOService`                                                                                 | File > Open / Save As orchestration, content override, `getContent()`.                                                                              |
| `AutosaveService`                                                                                     | Periodic autosave scheduling and status, writing recovery snapshots to IndexedDB.                                                                   |
| `ViewerZoomService`                                                                                   | Zoom level state (`zoom`, `zoomPercent`, `zoomIn`, `zoomOut`, `zoomReset`).                                                                         |
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
concern.

## Public services & components

The following are exported from the package root and safe to import for building custom UI around
the viewer or driving it programmatically.

### `LoadContentService`

Loads a `.pptx` and exposes everything parsed from it as signals: `slides`, `canvasSize`,
`theme`, `slideMasters`, `mediaDataUrls`, `embeddedFonts`, `coreProperties`, `appProperties`,
`sections`, `loading`, `error`, `isEncrypted`, `hasMacros`, and more, plus a computed
`slideCount`.

| Member                                   | Purpose                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `load(raw)`                              | `(raw: Uint8Array \| ArrayBuffer \| null \| undefined) => Promise<void>`: parse a buffer into the signals.    |
| `getContent()`                           | `() => Promise<Uint8Array>`: serialize the loaded presentation back to bytes.                                 |
| `saveSlides(slides, format?, sections?)` | Serialize an edited deck (for example `EditorStateService`'s slides) using the loaded presentation's handler. |

```ts
@Component({ providers: [LoadContentService] /* ... */ })
export class DeckStatsComponent {
	private readonly loader = inject(LoadContentService);

	async open(file: File): Promise<void> {
		await this.loader.load(await file.arrayBuffer());
		if (this.loader.error()) return;
		console.log(this.loader.slideCount(), this.loader.canvasSize());
	}
}
```

### `EditorStateService`

Signal-based editing state: `slides`, `sections`, `selectedIds`, `dirty`, `editTemplateMode`,
`templateElementsBySlideId`, `canUndo` / `canRedo` / `undoLabel` / `redoLabel`, and a large set of
imperative operations, all history-aware: `setSlides`, `updateElement(slideIndex, id, patch)`,
`addElement`, `deleteSelected`, `duplicateSelected`, `moveSelectedBy`, `alignSelected`,
`groupSelected`, `copySelected` / `paste`, `addSlide`, `deleteSlide`, `duplicateSlide`,
`moveSlide`, `undo`, `redo`, and more.

```ts
const editor = inject(EditorStateService);

editor.setSlides(loadedSlides); // clones, partitions template elements, resets history
editor.updateElement(0, 'el_12', { x: 120, y: 80 });
editor.select(['el_12']);
editor.duplicateSelected(0);
editor.undo();

const bytes = await this.loader.saveSlides(editor.snapshot());
```

### Collaboration

For building custom collaboration UIs or driving sync yourself. See
[Collaboration](/angular/collaboration).

| Export                                        | Purpose                                                                                                                                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CollaborationService`                        | `connect(config, options?)` / `disconnect()` / `retry()` for a Yjs session; signals for `status`, `presence`, `cursors`, `connectedCount`; `broadcastSlides`, `setCursor`, `setSelection`, `setActiveSlide`, `followUser`. Disconnects itself on destroy. |
| `CollaborationCursorsComponent`               | Renders remote cursors on the slide canvas.                                                                                                                                                                                                               |
| `RemoteSelectionOverlayComponent` (internals) | Renders remote users' element-selection highlights.                                                                                                                                                                                                       |
| `collaboration-helpers` exports               | `validateRoomId`, `sanitizeUserName`, `derivePresenceList`, `assignUserColor`, and more.                                                                                                                                                                  |

```ts
const collab = inject(CollaborationService);

await collab.connect(
	{ roomId: 'deck-42', serverUrl: 'wss://collab.example.com', userName: 'Ada' },
	{ onRemoteSlides: (slides) => this.editor.applyRemoteSlides(slides) },
);
```

### Rendering & renderers

`SlideCanvasComponent`, `ElementRendererComponent`, `ConnectorRendererComponent`,
`TableRendererComponent`, `ChartRendererComponent`, `SmartArtRendererComponent`,
`InkRendererComponent`, `OleRendererComponent`, `Model3DRendererComponent`, `ZoomRendererComponent`,
`EquationRendererComponent`: the per-element-type renderers `SlideCanvasComponent` composes.

### Export

| Export           | Purpose                                                                                                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExportService`  | Slide SVG export (`exportSlideToSvg`, `exportAllSlidesToSvg`), element rasterization (`exportElementToPng`, `copyElementAsPng`, `renderElement`), file download helpers (`savePptx`, `savePresentation`), and PDF/GIF/WebM assembly from rendered canvases. |
| `renderToCanvas` | Standalone `html2canvas-pro` wrapper with an oklch-colour workaround. See [Export](/angular/export).                                                                                                                                                        |

## Using an internal service directly

If the curated public services above don't cover what you need, every internal service, component,
and helper is also importable in full from `pptx-angular-viewer` itself (there is no separate
subpath):

```ts
import { ViewerZoomService, buildSaveSlides } from 'pptx-angular-viewer';
```

::: warning Internal building blocks
Everything documented on the [Complete Services Reference](/angular/services-reference) page is
re-exported unmodified from the same building blocks `PowerPointViewerComponent` composes
internally, behind the `pptx-angular-viewer/internals` subpath. They are **not covered by semver**:
signatures and behavior can change, and services/components can be renamed or removed, without a
major bump. Prefer the inputs/outputs/[public API](/angular/api) or the curated services above
first; reach for `internals` only for advanced integrations, and pin an exact version if you depend
on it.
:::

See the **[Complete Services Reference](/angular/services-reference)** for the full list and
[Overview](/angular/#internal-architecture-services-and-standalone-components) for the broader
architectural picture.
