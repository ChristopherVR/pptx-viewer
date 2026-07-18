<script lang="ts">
	/**
	 * SlideCanvas: the fixed-size, scaled slide stage-holder (Svelte port of
	 * Vue's `SlideCanvas.vue`, adapted to this binding's existing layout: the
	 * scrollable viewport and its `fitScale` measurement stay owned by
	 * `ViewerBody` rather than moving in here, since that's how this binding
	 * already computes `scale` today - this component starts from an
	 * already-computed `scale` prop instead of measuring its own viewport).
	 *
	 * Renders `SlideStage` plus whatever overlay content the host slots in via
	 * `children` (selection/editor layer, ink drawing, alignment guides,
	 * presentation annotations, collaboration cursors, transition overlay).
	 * Deliberately takes only flat, typed props (no live `EditorState` /
	 * `EditorController` instances) so it composes standalone in a host's own
	 * viewer shell; the overlay components that DO need those live instances
	 * are instantiated by the host and passed in as `children`, not by this
	 * component.
	 */
	import type { SlideCanvasProps } from './props';
	import SlideStage from './SlideStage.svelte';

	const {
		slide,
		canvasSize,
		mediaDataUrls,
		scale,
		presenting = false,
		editingActive = false,
		editTemplateMode = false,
		ontablecellcommit,
		onsmartartnodecommit,
		onsmartartnodefill,
		onstageholder,
		onstagepointerdown,
		onstagepointermove,
		onstagedblclick,
		onstagecontextmenu,
		onstageclick,
		children,
	}: SlideCanvasProps = $props();

	/** Reports the stage-holder node to the host on mount/teardown. */
	function attachStageHolder(node: HTMLDivElement, callback: ((el: HTMLDivElement | null) => void) | undefined) {
		callback?.(node);
		return {
			destroy(): void {
				callback?.(null);
			},
		};
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<!-- The stage holder is the editing hit-surface; the overlay above it
     (pointer-events:none except handles) lets clicks reach the rendered
     elements underneath. While presenting, a tap advances the show
     (keyboard advance is handled on the viewer root). -->
<div
	use:attachStageHolder={onstageholder}
	class="pptx-svelte-stage-holder"
	class:pptx-svelte-editing={editingActive}
	style={`width: ${canvasSize.width * scale}px; height: ${canvasSize.height * scale}px`}
	onpointerdown={editingActive ? onstagepointerdown : undefined}
	onpointermove={editingActive ? onstagepointermove : undefined}
	ondblclick={editingActive ? onstagedblclick : undefined}
	oncontextmenu={editingActive ? onstagecontextmenu : undefined}
	onclick={onstageclick}
>
	<SlideStage
		{slide}
		{canvasSize}
		{mediaDataUrls}
		{scale}
		{presenting}
		interactive
		{editTemplateMode}
		{ontablecellcommit}
		{onsmartartnodecommit}
		{onsmartartnodefill}
	/>
	{#if children}{@render children()}{/if}
</div>

<style>
	.pptx-svelte-stage-holder {
		position: relative;
		margin: auto;
		flex: none;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-editing {
		cursor: default;
		touch-action: none;
	}
</style>
