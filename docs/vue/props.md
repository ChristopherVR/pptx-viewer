---
title: Component Props
description: Complete reference for PowerPointViewerProps and PowerPointViewerEmits - content, editing, theming, autosave, and collaboration props/events of the PowerPointViewer component.
---

# Component Props

`<PowerPointViewer>` accepts the `PowerPointViewerProps` interface below and emits the events in
`PowerPointViewerEmits`. Only `content` is required; everything else is optional. This reference is
taken directly from `packages/vue/src/viewer/types.ts`.

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { PowerPointViewerProps } from 'pptx-vue-viewer';
</script>
```

::: tip
`PowerPointViewer` also has a template-ref surface, see [`defineExpose`](/vue/handle) - that is not
part of `PowerPointViewerProps`.
:::

## Content

| Prop       | Type                        | Default    | Description                                                                                     |
| ---------- | --------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `content`  | `Uint8Array \| ArrayBuffer` | (required) | Raw `.pptx` file bytes.                                                                         |
| `filePath` | `string`                    | -          | Original file path or name. Used as a version-history label context; see [Autosave](#autosave). |
| `fileName` | `string`                    | -          | Display name of the open document, shown in the title bar.                                      |

## Editing

| Prop      | Type      | Default | Description                                                                                                                                        |
| --------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canEdit` | `boolean` | `false` | Enables editing actions (toolbar editing controls, inspector edits, inline text editing, slide management). When `false`, the viewer is read-only. |

## Events

| Event                  | Payload                       | Description                                                                           |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `@dirty-change`        | `isDirty: boolean`            | Fired when the unsaved-changes flag flips.                                            |
| `@content-change`      | `content: Uint8Array`         | Fired with the re-serialised document bytes when content changes.                     |
| `@autosave`            | `content: Uint8Array`         | Fired with the re-serialised bytes on each autosave cycle; see [Autosave](#autosave). |
| `@active-slide-change` | `slideIndex: number`          | Fired when the active slide changes.                                                  |
| `@zoom-change`         | `zoom: number`                | Fired when the zoom level changes.                                                    |
| `@slide-count-change`  | `count: number`               | Fired when the total slide count changes (slide added/deleted).                       |
| `@selection-change`    | `elementIds: string[]`        | Fired when element selection changes.                                                 |
| `@mode-change`         | `mode: string`                | Fired when the viewer mode changes (e.g. edit to present).                            |
| `@start-collaboration` | `config: CollaborationConfig` | Fired when the user starts a session from the Share dialog.                           |
| `@stop-collaboration`  | -                             | Fired when the user stops a session from the Share dialog.                            |

`content` and `autosave` share one signature (`Uint8Array` payload) in the underlying
`PowerPointViewerEmits` type, as do `active-slide-change`, `zoom-change`, and `slide-count-change`
(all `number` payloads).

::: info No `onOpenFile` event
File > Open is a **prop**, not an event: `onOpenFile?: () => void` (see below), matching React's
callback-prop shape rather than the emit convention used elsewhere in this component.
:::

## Presentation / authoring

| Prop         | Type         | Default | Description                                                                                                                                            |
| ------------ | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `authorName` | `string`     | -       | Display name used as the author for comments and annotations. Falls back to `collaboration.userName` when collaborating, otherwise `'You'`.            |
| `class`      | `string`     | -       | Optional class name applied to the viewer root element (props key is `class`, not `className`).                                                        |
| `smartArt3D` | `boolean`    | `false` | Opt in to the experimental Three.js SmartArt renderer (extruded 3D blocks on WebGL). Requires the optional `three` peer; falls back to SVG without it. |
| `onOpenFile` | `() => void` | -       | Host override for the File > Open action: bypasses the built-in file picker; the host then supplies a new `content` prop instead.                      |

## Theming

| Prop    | Type          | Default | Description                                                                                                                                                               |
| ------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme` | -       | Theme configuration: partial color overrides, a custom `radius`, and arbitrary `cssVars`. Unset values fall back to the built-in dark theme. See [Theming](/vue/theming). |

```vue
<PowerPointViewer
	:content="bytes"
	:theme="{ colors: { primary: '#6366f1', background: '#0f172a' }, radius: '0.75rem' }"
/>
```

## Collaboration

These props enable and control real-time co-editing. See [Collaboration](/vue/collaboration) for
the full flow and the `CollaborationConfig` shape.

| Prop            | Type                                                         | Default | Description                                                                                                                                         |
| --------------- | ------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration` | `CollaborationConfig`                                        | -       | When provided, enables collaborative editing with live cursors, presence, and Yjs CRDT sync. Requires the `yjs` and `y-websocket`/`y-webrtc` peers. |
| `shareDefaults` | `{ roomId?: string; userName?: string; serverUrl?: string }` | -       | Default values for the Share dialog fields. If omitted, the fields start empty.                                                                     |

Starting/stopping a session is controlled via the `@start-collaboration` / `@stop-collaboration`
events above: the host sets/clears the `collaboration` prop in response.

## Full interface

```ts
interface PowerPointViewerProps {
	content: Uint8Array | ArrayBuffer;
	filePath?: string;
	fileName?: string;
	canEdit?: boolean;
	autosave?: boolean;
	autosaveIntervalMs?: number;
	class?: string;
	authorName?: string;
	theme?: ViewerTheme;
	collaboration?: CollaborationConfig;
	shareDefaults?: { roomId?: string; userName?: string; serverUrl?: string };
	onOpenFile?: () => void;
	smartArt3D?: boolean;
}

interface PowerPointViewerEmits {
	(e: 'dirty-change', isDirty: boolean): void;
	(e: 'content-change' | 'autosave', content: Uint8Array): void;
	(e: 'active-slide-change' | 'zoom-change' | 'slide-count-change', value: number): void;
	(e: 'mode-change', mode: string): void;
	(e: 'selection-change', elementIds: string[]): void;
	(e: 'start-collaboration', config: CollaborationConfig): void;
	(e: 'stop-collaboration'): void;
}
```

## Autosave {#autosave}

Autosave is **opt-in and host-driven**: unlike some editors that persist to browser storage on their
own, `pptx-vue-viewer` debounces slide changes and hands the serialised bytes back to the host via
`@autosave`; the host decides where they go.

| Prop                 | Type      | Default | Description                                                          |
| -------------------- | --------- | ------- | -------------------------------------------------------------------- |
| `autosave`           | `boolean` | `false` | Enables the debounced autosave timer. Also requires `canEdit`.       |
| `autosaveIntervalMs` | `number`  | `2000`  | Debounce window (ms) between the last edit and the `@autosave` emit. |

```vue
<PowerPointViewer
	:content="bytes"
	can-edit
	autosave
	:autosave-interval-ms="5000"
	@autosave="persist"
/>
```

The title bar exposes an AutoSave toggle the user can switch off at runtime; toggling it off stops
new saves without discarding anything already emitted. Each autosave cycle also captures an
in-memory, session-scoped version-history snapshot (see the Version History panel), separate from
the `@autosave` payload itself.

::: warning No built-in persistence or recovery
This differs from the React binding's IndexedDB-backed autosave/recovery flow: the Vue viewer does
not write to IndexedDB and has no built-in "recover an unsaved session" prompt. If you need that
behaviour, persist the `@autosave` bytes yourself (e.g. to IndexedDB, `localStorage`, or your
backend) and re-supply `content` on reload.
:::
