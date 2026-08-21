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

| Prop         | Type         | Default | Description                                                                                                                                 |
| ------------ | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorName` | `string`     | -       | Display name used as the author for comments and annotations. Falls back to `collaboration.userName` when collaborating, otherwise `'You'`. |
| `class`      | `string`     | -       | Optional class name applied to the viewer root element (props key is `class`, not `className`).                                             |
| `smartArt3D` | `boolean`    | `false` | Opt in to the Three.js SmartArt renderer (extruded 3D blocks on WebGL). Requires the optional `three` peer; falls back to SVG without it.   |
| `onOpenFile` | `() => void` | -       | Host override for the File > Open action: bypasses the built-in file picker; the host then supplies a new `content` prop instead.           |

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

`pptx-vue-viewer` debounces slide changes, writes a crash-recovery snapshot to the shared IndexedDB
store, and hands the serialised bytes back to the host via `@autosave`.

| Prop                 | Type      | Default                | Description                                                                      |
| -------------------- | --------- | ---------------------- | -------------------------------------------------------------------------------- |
| `autosave`           | `boolean` | `true`                 | Recovery autosave. A policy ceiling over the title-bar toggle; see below.        |
| `autosaveIntervalMs` | `number`  | File > Options cadence | Debounce window (ms). An explicit value outranks the user's AutoRecover setting. |

### Who decides: the `autosave` prop or the AutoSave toggle? {#autosave-policy}

The rule is the same in **all five bindings** and lives in one shared decision function,
`resolveAutosaveActivation`:

> **The `autosave` prop is a policy ceiling. The title-bar AutoSave toggle is the user's preference
> inside it.**

| `autosave` | What runs                                                       | The toggle                    |
| ---------- | --------------------------------------------------------------- | ----------------------------- |
| omitted    | Autosave runs; the user's toggle decides, defaulting to **on**. | Works.                        |
| `true`     | Same as omitted: the host permits it, the user decides.         | Works.                        |
| `false`    | Autosave is off, and no recovery prompt is offered on load.     | **Inert** (it must not move). |

A preference can never exceed a policy, which is why `autosave: false` also takes the switch away: a
control that silently does nothing is worse than no control. `canEdit`/`editable` and a `filePath`
key remain hard requirements either way.

The same rule governs the cadence: an explicit `autosaveIntervalMs` is a host policy honoured as
given, and omitting it follows the user's **File > Options > Save > "Save AutoRecover information
every N minutes"** (two minutes by default).

The default is `true` because crash recovery that is off by default is crash recovery nobody has.

### Recovering a snapshot

When a deck finishes loading and a snapshot newer than 24 hours exists for the same key, the viewer
raises a **"Recover unsaved changes?"** dialog offering Restore or Discard. Restore loads the
snapshot's bytes; Discard deletes it. It is deliberately not raised for a snapshot this tab has
already taken delivery of (for example when the host itself restored it through
`restoreSessionDeck`).

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

::: info Persistence and recovery prompt
Each autosave cycle also writes the bytes to the shared IndexedDB recovery store (the same store
React, Angular, Svelte and vanilla use), so **File > Open**'s "Recent" list and **File > Account**'s
Storage &amp; Privacy panel report real data. Those snapshots are stored as a plain ZIP even for a
password-protected deck, so recovery can read them back without a password.

Vue also shows the "recover an unsaved session" **prompt** on load (`AutosaveRecoveryDialog`),
matching every other binding.
:::
