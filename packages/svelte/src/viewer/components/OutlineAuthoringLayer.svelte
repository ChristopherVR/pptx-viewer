<script lang="ts">
	/**
	 * OutlineAuthoringLayer: stage-level host of the Edit Points and Freeform:
	 * Shape / Curve overlays (Svelte port of React's
	 * `canvas/OutlineAuthoringLayer.tsx`). The Svelte overlay slot sits in the
	 * UNSCALED stage holder, so this wrapper applies the same `scale` transform
	 * `SlideStage` does and both overlays work in plain slide pixels. Leaves
	 * Edit Points when its shape disappears (deleted, slide changed), becomes
	 * locked, or the host switched the feature off.
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { canEditElementPoints, isEditPointsEnabled } from 'pptx-viewer-shared';

	import type { EditorState } from '../editor/editor-state.svelte';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import EditPointsOverlay from './EditPointsOverlay.svelte';
	import FreeformToolOverlay from './FreeformToolOverlay.svelte';

	const { editor, canvasSize, scale }: { editor: EditorState; canvasSize: CanvasSize; scale: number } =
		$props();

	const customization = useViewerCustomization();
	const outline = $derived(editor.outlineOps);
	const element = $derived(outline.editPointsElement);
	const editable = $derived(
		Boolean(element) &&
			editor.editable &&
			canEditElementPoints(element) &&
			isEditPointsEnabled(customization.resolved),
	);

	$effect(() => {
		if (outline.editPointsId && !editable) {
			outline.exitEditPoints();
		}
	});

	const layerStyle = $derived(
		`width: ${canvasSize.width}px; height: ${canvasSize.height}px; transform: scale(${scale}); transform-origin: top left`,
	);
</script>

{#if outline.freeformTool}
	<div class="pptx-svelte-outline-layer" style={layerStyle}>
		{#key outline.freeformTool}
			<FreeformToolOverlay
				tool={outline.freeformTool}
				{canvasSize}
				{scale}
				oncommit={(shape) => outline.commitFreeform(shape)}
				oncancel={() => outline.armFreeformTool(null)}
			/>
		{/key}
	</div>
{:else if element && editable}
	<div class="pptx-svelte-outline-layer" style={layerStyle}>
		{#key element.id}
			<EditPointsOverlay
				{element}
				{canvasSize}
				{scale}
				hiddenCommands={customization.resolved.hiddenEditPointsCommands}
				oncommit={(id, patch) => outline.commitEditPoints(id, patch)}
				onexit={() => outline.exitEditPoints()}
			/>
		{/key}
	</div>
{/if}

<style>
	.pptx-svelte-outline-layer {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 60;
		pointer-events: none;
	}
</style>
