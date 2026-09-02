<script lang="ts">
	/**
	 * ActiveXOverlay: draws a static placeholder for each `p:controls > p:control`
	 * ActiveX control on the slide (Svelte port of Vanilla's
	 * `buildActiveXControlsOverlay` / React's `ActiveXControlOverlay`). ActiveX
	 * controls cannot run inside a viewer, so this renders the control's static
	 * fallback picture when core resolved one, otherwise a labelled placeholder
	 * badge, so the slide shows where the control lives instead of a blank gap.
	 * Svelte had no ActiveX overlay at all before this.
	 */
	import type { PptxActiveXControl } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { getActiveXControlOverlayView } from 'pptx-viewer-shared';

	const {
		controls,
		canvasSize,
	}: {
		controls: readonly PptxActiveXControl[];
		canvasSize: CanvasSize;
	} = $props();
</script>

<div class="pptx-svelte-activex-overlay" data-testid="pptx-activex-overlay">
	{#each controls as control, index (control.relId + String(index))}
		{@const view = getActiveXControlOverlayView(control, canvasSize, index)}
		{#if view.className === 'image' && view.imageUrl}
			<img
				class="pptx-svelte-activex-overlay-image"
				src={view.imageUrl}
				alt={view.label}
				title={`ActiveX control: ${view.label}`}
				style={`left:${view.left}px;top:${view.top}px;width:${view.width}px;height:${view.height}px`}
			/>
		{:else}
			<div
				class="pptx-svelte-activex-overlay-placeholder"
				title={`ActiveX control: ${view.label} (interactive controls are not supported in the viewer)`}
				style={`left:${view.left}px;top:${view.top}px;width:${view.width}px;height:${view.height}px`}
			>{view.label}</div>
		{/if}
	{/each}
</div>

<style>
	.pptx-svelte-activex-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 40;
	}

	.pptx-svelte-activex-overlay-image,
	.pptx-svelte-activex-overlay-placeholder {
		position: absolute;
		box-sizing: border-box;
	}

	.pptx-svelte-activex-overlay-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 2px 6px;
		border: 1px dashed rgba(100, 116, 139, 0.8);
		border-radius: 4px;
		background: rgba(148, 163, 184, 0.14);
		color: rgb(51, 65, 85);
		font-size: 11px;
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
