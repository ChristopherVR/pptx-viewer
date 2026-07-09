---
title: Component Inputs & Outputs
description: Complete reference for PowerPointViewerComponent's @Input()s and @Output()s - content, editing, events, theming, and collaboration.
---

# Component Inputs & Outputs

`PowerPointViewerComponent` (selector `pptx-viewer`) exposes its configuration through signal-based
`input()`s and events through `output()`s. Only `content` is meaningful for a read-only viewer;
everything else is optional. This reference is taken directly from the source component.

```ts
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
```

::: tip
Angular has no `forwardRef` handle: `PowerPointViewerComponent`'s public methods (navigation,
undo/redo, zoom, `getContent()`, ...) live directly on the component instance, reachable via a
template reference variable or `viewChild()`. See [Public API](/angular/api).
:::

## Content

| Input      | Type                                | Default | Description                                                                                                     |
| ---------- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `content`  | `Uint8Array \| ArrayBuffer \| null` | `null`  | Raw `.pptx` file bytes. Accepts either typed array or `ArrayBuffer` directly - no manual wrapping.              |
| `filePath` | `string \| undefined`               | -       | Original file path or name. Keys autosave recovery in IndexedDB and shows in the title bar.                     |
| `fileName` | `string \| undefined`               | -       | Display name shown in the title bar next to the save-location status. Falls back to a localised "Presentation". |

::: tip Autosave recovery requires `filePath`
The viewer's built-in autosave timer periodically serializes the document to IndexedDB keyed by
`filePath`. Without a stable `filePath` across reloads, recovery has no key to look up.
:::

## Editing

| Input     | Type      | Default | Description                                                                                                                   |
| --------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `canEdit` | `boolean` | `false` | Enables editing actions (ribbon editing tools, inspector edits, inline text editing, slide management). `false` is read-only. |

## Events (`@Output()`s)

| Output               | Payload                       | Description                                                                                                |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `dirtyChange`        | `boolean`                     | Fires when the unsaved-changes flag toggles.                                                               |
| `contentChange`      | `Uint8Array`                  | Fires with the re-serialized document bytes whenever [`getContent()`](/angular/api) materialises the deck. |
| `activeSlideChange`  | `number`                      | Fires when the active slide changes.                                                                       |
| `modeChange`         | `string`                      | Fires when the viewer mode changes: `'preview'`, `'edit'`, `'present'`, or `'master'`.                     |
| `zoomChange`         | `number`                      | Fires when the zoom level changes.                                                                         |
| `selectionChange`    | `string[]`                    | Fires when element selection changes.                                                                      |
| `slideCountChange`   | `number`                      | Fires when the total slide count changes (slide added/deleted).                                            |
| `propertiesChange`   | `Partial<PptxCoreProperties>` | Fires when the user edits document properties (title, author, ...) in the Info dialog.                     |
| `startCollaboration` | `CollaborationConfig`         | Fires when a session starts from the Share/Broadcast dialog. Set the `collaboration` input in response.    |
| `stopCollaboration`  | `void`                        | Fires when the session stops from the Share/Broadcast dialog. Clear the `collaboration` input in response. |

::: info
`contentChange` delivers a `Uint8Array`, not a boolean. To pull content on demand instead, call
[`getContent()`](/angular/api) on the component instance.
:::

## Presentation / authoring

| Input        | Type                        | Default | Description                                                                                                                                                  |
| ------------ | --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `authorName` | `string \| undefined`       | -       | Display name used as the author for comments/annotations and as the broadcast owner's name. Falls back to `collaboration.userName` or `'You'`/`'Presenter'`. |
| `class`      | `string`                    | `''`    | Optional class name applied to the viewer's root element.                                                                                                    |
| `smartArt3D` | `boolean`                   | `false` | Opt in to the experimental Three.js SmartArt renderer (extruded 3D blocks on WebGL). Requires the optional `three` peer; falls back to SVG without it.       |
| `onOpenFile` | `(() => void) \| undefined` | -       | Host override for the File ▸ Open action: bypasses the built-in native file picker; the host then supplies a new `content` value instead.                    |

## Theming

| Input   | Type                       | Default | Description                                                                                                                                                                   |
| ------- | -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme \| undefined` | -       | Theme configuration: partial color overrides, a custom `radius`, and arbitrary `cssVars`. Unset values fall back to the built-in dark theme. See [Theming](/angular/theming). |

```ts
<pptx-viewer
  [content]="bytes"
  [theme]="{ colors: { primary: '#6366f1', background: '#0f172a' }, radius: '0.75rem' }"
/>
```

## Collaboration

These inputs enable and control real-time co-editing. See [Collaboration](/angular/collaboration)
for the full flow and the `CollaborationConfig` shape.

| Input           | Type                                                                      | Default | Description                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collaboration` | `CollaborationConfig \| undefined`                                        | -       | When provided, enables collaborative editing with live cursors, presence, and Yjs CRDT sync. Requires the `yjs` peer plus `y-websocket` or `y-webrtc`. |
| `shareDefaults` | `{ roomId?: string; userName?: string; serverUrl?: string } \| undefined` | -       | Default values for the Share/Broadcast dialog fields. If omitted, the fields start empty (userName falls back to `authorName`).                        |

::: info
`collaboration` is controlled, same as React/Vue. The viewer does not start a session on its own -
listen for `startCollaboration` to set the input, and `stopCollaboration` to clear it.
:::

## Full input/output list

```ts
class PowerPointViewerComponent {
	// Inputs
	readonly content = input<Uint8Array | ArrayBuffer | null>(null);
	readonly canEdit = input<boolean>(false);
	readonly class = input<string>('');
	readonly theme = input<ViewerTheme | undefined>(undefined);
	readonly filePath = input<string | undefined>(undefined);
	readonly fileName = input<string | undefined>(undefined);
	readonly collaboration = input<CollaborationConfig | undefined>(undefined);
	readonly authorName = input<string>();
	readonly shareDefaults = input<
		{ roomId?: string; userName?: string; serverUrl?: string } | undefined
	>(undefined);
	readonly onOpenFile = input<(() => void) | undefined>(undefined);
	readonly smartArt3D = input<boolean>(false);

	// Outputs
	readonly activeSlideChange = output<number>();
	readonly dirtyChange = output<boolean>();
	readonly contentChange = output<Uint8Array>();
	readonly propertiesChange = output<Partial<PptxCoreProperties>>();
	readonly modeChange = output<string>();
	readonly zoomChange = output<number>();
	readonly selectionChange = output<string[]>();
	readonly slideCountChange = output<number>();
	readonly startCollaboration = output<CollaborationConfig>();
	readonly stopCollaboration = output<void>();
}
```

## Notes on triggering features

Navigation, mode-switching, zoom, undo/redo, and selection are available through the
[public API](/angular/api) (`viewer.goNext()`, `viewer.setMode('present')`, etc.). Export and print
are driven through the built-in ribbon/dialogs. See [Export](/angular/export) for details on
document export.
