---
title: Composables
description: The composables-based architecture of PowerPointViewer, the curated set of public composables exported from pptx-vue-viewer/viewer, and the full internal set exposed via pptx-vue-viewer/internals.
---

# Composables

`PowerPointViewer.vue` is a thin `<script setup>` orchestrator. Almost all of its logic lives in
**110+ custom composables** under `viewer/composables/`, composed inside the component, while the
visual components are largely presentational. State is held entirely in Vue's reactivity system;
there is no external state library.

::: info Public vs internal
Most of these composables are **internal architecture**: they assume a specific composition order
and shared inputs. A small curated subset is exported from `pptx-vue-viewer/viewer` with a normal
semver-stable API. The **complete** set is also importable from `pptx-vue-viewer/internals`:
internal building blocks that are not covered by semver, so prefer the stable root exports. See
[Complete Composables Reference](/vue/composables-reference).
:::

## Architecture (internal)

These composables describe how the viewer is wired. They are importable (see below) but assume a
specific composition order and shared inputs; treat this table as conceptual reference, not an API
contract.

| Composable                  | Concern                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `useLoadContent`            | Parses the PPTX buffer on load via `PptxHandler`.                                |
| `useEditorHistory`          | Undo/redo snapshot stack, aware of the template (master/layout) element layer.   |
| `useEditorOperations`       | Element create/update/delete/duplicate primitives.                               |
| `useElementDrag`            | Move / resize / rotate / adjust, plus snap & alignment guides.                   |
| `useElementInsertion`       | Shape / image / text box / table / chart insertion.                              |
| `useSlideOperations`        | Add / delete / duplicate / reorder slides.                                       |
| `useAutosave`               | Debounced autosave timer + status (see [Props > Autosave](/vue/props#autosave)). |
| `usePresentationModeWiring` | Slideshow navigation wiring into the component.                                  |
| `useExportWiring`           | PNG / PDF / GIF / WebM export + print, wired into the component.                 |
| `useCollaborationWiring`    | Share/Broadcast dialog + prop-driven Yjs session lifecycle.                      |
| `useRibbonProps`            | Composes the full Office-ribbon `RibbonProps` contract.                          |
| `useEditorKeyboard`         | Config-driven keyboard-shortcut registry + dispatch.                             |
| `useIsMobile`               | Device/viewport classification (mobile/tablet/orientation).                      |

There are dozens more (dialogs, comments, sections, SmartArt editing, table editing, presentation
sub-composables, mobile chrome, etc.). See the
**[Complete Composables Reference](/vue/composables-reference)** for the full list, grouped by
concern.

## Public composables

The following are exported from `pptx-vue-viewer/viewer` and are safe to import. They are opt-in
and tree-shakeable. The root `pptx-vue-viewer` entry re-exports only the collaboration pair
(`useCollaboration`, `useCollaborationWiring`); the rest come from the `/viewer` subpath.

```ts
import {
	useCollaboration,
	useEditorHistory,
	useEditorOperations,
	useLoadContent,
} from 'pptx-vue-viewer/viewer';
```

### `useLoadContent`

Parses a `.pptx` buffer via `PptxHandler` and exposes the result as reactive state. The input is a
`MaybeRefOrGetter`, so a plain value, a `ref`, or a getter all work; the load re-runs when it
changes.

```ts
function useLoadContent(
	content: MaybeRefOrGetter<Uint8Array | ArrayBuffer | null | undefined>,
): UseLoadContentResult;
```

`UseLoadContentResult` exposes (all reactive): `slides`, `templateElementsBySlideId`,
`canvasSize`, `theme`, `themeColorMap`, `slideMasters`, `layoutOptions`, `mediaDataUrls`,
`loading`, `error`, `isEncrypted`, `handler` (the live `PptxHandler`, for saving), plus document
metadata (`coreProperties`, `appProperties`, `customProperties`, `sections`, `customShows`,
`embeddedFonts`, `signatures`, and more).

```vue
<script setup lang="ts">
import { useLoadContent } from 'pptx-vue-viewer/viewer';

const props = defineProps<{ bytes: ArrayBuffer | null }>();

const { slides, canvasSize, loading, error, handler } = useLoadContent(() => props.bytes);

async function save(): Promise<Uint8Array | undefined> {
	return handler.value?.save([...slides.value]);
}
</script>

<template>
	<p v-if="loading">Parsing...</p>
	<p v-else-if="error">{{ error }}</p>
	<p v-else>{{ slides.length }} slides at {{ canvasSize.width }}x{{ canvasSize.height }}</p>
</template>
```

### `useEditorHistory` and `useEditorOperations`

These two compose into a minimal headless editor. `useEditorHistory(slides)` owns the undo/redo
snapshot stack; `useEditorOperations` provides element CRUD that snapshots through it.

```ts
function useEditorHistory(
	slides: Ref<PptxSlide[]>,
	templateElementsBySlideId?: Ref<TemplateElementMap>,
): {
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	pushHistory: () => void; // call immediately BEFORE committing a mutation
	undo: () => void;
	redo: () => void;
	clearHistory: () => void;
};

function useEditorOperations(input: {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	pushHistory: () => void;
	selectedElementIds?: Ref<string[]>;
	templateElementsBySlideId?: Ref<TemplateElementMap>;
}): EditorOperations;
```

`EditorOperations` includes `activeSlide`, `selectedElementIds`, `addElement`, `updateElement`,
`removeElement`, `transformElement` / `moveElement`, `duplicateElement`, `bringForward`,
`sendBackward`, `reorder`, and `updateElementText`.

```ts
import { ref } from 'vue';
import { useEditorHistory, useEditorOperations, useLoadContent } from 'pptx-vue-viewer/viewer';

const { slides } = useLoadContent(() => props.bytes);
const activeSlideIndex = ref(0);

const history = useEditorHistory(slides);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});

ops.updateElementText('el_12', 'Updated headline');
ops.transformElement('el_12', { x: 120, y: 80 });
history.undo(); // reverts both, most recent first
```

::: tip Snapshot ordering
`pushHistory()` snapshots the **current** state, so it must run before a mutation is committed.
The operations returned by `useEditorOperations` handle this for you; only call `pushHistory`
manually when you mutate `slides` yourself.
:::

### `useCollaboration` and `useCollaborationWiring`

`useCollaboration` manages a Yjs session, presence, cursors, and elected-writer synchronization
without the viewer component. See [Collaboration](/vue/collaboration) for the full guide.

```ts
function useCollaboration(options: {
	slides: Ref<PptxSlide[]>;
	onRemoteSlides: (slides: PptxSlide[]) => void;
	userColor?: string;
	canvasWidth?: Ref<number> | number;
	canvasHeight?: Ref<number> | number;
	getSourceBytes?: () => Uint8Array | null;
	getTemplateElements?: () => Record<string, PptxElement[]>;
}): UseCollaborationResult;
```

The result exposes reactive `status`, `connected`, `cursors`, `remotePresences`,
`connectedCount`, `followedSlideIndex`, `broadcasterSlideIndex`, and the imperative
`start(config)`, `stop()`, `retry()`, `setCursor(x, y)`, `setSelection(ids)`,
`setActiveSlide(index)`, and `followUser(clientId)`.

```ts
const collab = useCollaboration({
	slides,
	onRemoteSlides: (next) => (slides.value = next),
});

await collab.start({
	roomId: 'deck-42',
	serverUrl: 'wss://collab.example.com',
	userName: 'Ada',
});
```

`useCollaborationWiring` is the higher-level variant the component itself uses: the full viewer
collaboration + broadcast dialog lifecycle.

### Helper functions

Alongside the composables, `pptx-vue-viewer/viewer` exports pure helper functions used by the
renderer components: `getContainerStyle`, `getShapeFillStrokeStyle`, `getTextBlockStyle`,
`getImageSrc`, `getResolvedShapeClipPath`, `getResolvedShapeClipPathFor`,
`collectMediaElements`, `collectImagePaths`, `buildInitialGuides`, plus the audience/presenter
content-sharing helpers (`isAudienceTab`, `storeAudienceContent`, `loadAudienceContent`,
`clearAudienceContent`) and `useToolbarVisibility`.

The stable entry also exports `CollaborationCursors`, `CollaborationStatusIndicator`,
`RemoteSelectionOverlay`, and `FollowModeBar` for custom presence UI. See
[Collaboration](/vue/collaboration).

## Using an internal composable directly

If the curated public composables above don't cover what you need, every internal composable is
also importable in full from `pptx-vue-viewer/internals`:

```ts
import { useAlignGroup, useAutosave } from 'pptx-vue-viewer/internals';
```

::: warning Internal building blocks
`pptx-vue-viewer/internals` re-exports the same composables `PowerPointViewer.vue`
composes internally (directly, or via a wiring composable used by a child component), unmodified.
They are **not covered by semver**: signatures and behavior can change, and composables can be
renamed or removed, without a major bump. Prefer the props/`defineExpose` API or the curated
`pptx-vue-viewer/viewer` composables first; reach for `internals` only for advanced integrations,
and pin an exact version if you depend on it.
:::

See the **[Complete Composables Reference](/vue/composables-reference)** for the full list and
[Overview](/vue/#composables-based-architecture) for the broader architectural picture.
