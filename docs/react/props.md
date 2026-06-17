---
title: Component Props
description: Complete reference for PowerPointViewerProps - content, editing, callbacks, theming, and collaboration props of the PowerPointViewer component.
---

# Component Props

The `PowerPointViewer` component accepts the `PowerPointViewerProps` interface below. Only `content`
is required; everything else is optional. This reference is taken directly from the source interface.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerProps } from 'pptx-react-viewer';
```

::: tip
`PowerPointViewer` uses `forwardRef`, so you can also pass a `ref` of type
[`PowerPointViewerHandle`](/react/handle) - that is not part of `PowerPointViewerProps`.
:::

## Content

| Prop       | Type         | Default    | Description                                                               |
| ---------- | ------------ | ---------- | ------------------------------------------------------------------------- |
| `content`  | `Uint8Array` | (required) | Raw `.pptx` file bytes. Wrap an `ArrayBuffer` with `new Uint8Array(buf)`. |
| `filePath` | `string`     | -          | Original file path. Used for autosave recovery and display.               |

::: warning `content` type
The prop is a `Uint8Array`, not an `ArrayBuffer`. See [Getting Started](/react/getting-started) for
conversion from a `fetch`/file `ArrayBuffer`.
:::

## Editing

| Prop      | Type      | Default | Description                                                                                                                                        |
| --------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canEdit` | `boolean` | `false` | Enables editing actions (toolbar editing controls, inspector edits, inline text editing, slide management). When `false`, the viewer is read-only. |

## Callbacks

| Prop                  | Type                            | Default | Description                                                        |
| --------------------- | ------------------------------- | ------- | ------------------------------------------------------------------ |
| `onDirtyChange`       | `(isDirty: boolean) => void`    | -       | Called when the unsaved-changes flag flips.                        |
| `onContentChange`     | `(content: Uint8Array) => void` | -       | Called with the re-serialized document bytes when content changes. |
| `onActiveSlideChange` | `(slideIndex: number) => void`  | -       | Called when the active slide changes.                              |

::: info
`onContentChange` delivers a `Uint8Array` (the serialized document), not a boolean. To pull content
on demand instead, use the handle's [`getContent()`](/react/handle).
:::

## Presentation / authoring

| Prop         | Type     | Default | Description                                                                                                                                 |
| ------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorName` | `string` | -       | Display name used as the author for comments and annotations. Falls back to `collaboration.userName` when collaborating, otherwise `'You'`. |
| `className`  | `string` | -       | Optional class name applied to the viewer root element.                                                                                     |

## Theming

| Prop    | Type          | Default | Description                                                                                                                                                                 |
| ------- | ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme` | -       | Theme configuration: partial color overrides, a custom `radius`, and arbitrary `cssVars`. Unset values fall back to the built-in dark theme. See [Theming](/react/theming). |

```tsx
<PowerPointViewer
	content={bytes}
	theme={{
		colors: { primary: '#6366f1', background: '#0f172a' },
		radius: '0.75rem',
	}}
/>
```

## Collaboration

These props enable and control real-time co-editing. See [Collaboration](/react/collaboration) for
the full flow and the `CollaborationConfig` shape.

| Prop                   | Type                                                         | Default | Description                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration`        | `CollaborationConfig`                                        | -       | When provided, enables collaborative editing with live cursors, presence, and Yjs CRDT sync. Requires the `yjs` and `y-websocket` peer dependencies. |
| `onStartCollaboration` | `(config: CollaborationConfig) => void`                      | -       | Called when the user starts a session from the Share dialog. The host should set the `collaboration` prop with the returned config.                  |
| `onStopCollaboration`  | `() => void`                                                 | -       | Called when the user stops a session from the Share dialog. The host should clear the `collaboration` prop.                                          |
| `shareDefaults`        | `{ roomId?: string; userName?: string; serverUrl?: string }` | -       | Default values for the Share dialog fields. If omitted, the fields start empty.                                                                      |

::: info
`collaboration` is controlled. The viewer does not start a session on its own - wire
`onStartCollaboration` to set the `collaboration` prop, and `onStopCollaboration` to clear it.
:::

## Full interface

```ts
interface PowerPointViewerProps {
	content: Uint8Array;
	filePath?: string;

	onDirtyChange?: (isDirty: boolean) => void;
	onContentChange?: (content: Uint8Array) => void;
	onActiveSlideChange?: (slideIndex: number) => void;

	canEdit?: boolean;
	className?: string;
	authorName?: string;

	theme?: ViewerTheme;

	collaboration?: CollaborationConfig;
	onStartCollaboration?: (config: CollaborationConfig) => void;
	onStopCollaboration?: () => void;
	shareDefaults?: {
		roomId?: string;
		userName?: string;
		serverUrl?: string;
	};
}
```

## Notes on triggering features

The viewer exposes **no props** for triggering export, navigation, mode-switching, or
print. Those are driven internally through the toolbar/dialogs and, for saving, through the
imperative [handle](/react/handle). Export specifically is documented in [Export](/react/export).
