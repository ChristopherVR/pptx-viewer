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
		gridSpacingPx = 12,
		editingActive = false,
		editTemplateMode = false,
		editingElementId = null,
		ontablecellcommit,
		onsmartartnodecommit,
		onsmartartnodefill,
		onchartpointcommit,
		ontableresizecolumns,
		ontableresizerow,
		comments = [],
		oncommentmarkerclick,
		onstageholder,
		onstagepointerdown,
		onstagepointermove,
		onstagedblclick,
		onstagecontextmenu,
		onstageclick,
		aiPickMode = false,
		aiActive = false,
		onaipickelement,
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

	// ── AI pick mode ────────────────────────────────────────────────────────
	// While the AI panel is picking, the next element click(s) become the
	// assistant's focus (and get highlighted) instead of selecting / inline
	// editing. pointerdown is swallowed so a pick never starts a drag.
	const pickActive = $derived(aiPickMode && Boolean(onaipickelement) && editingActive);

	function pickFromEvent(event: MouseEvent): void {
		event.stopPropagation();
		event.preventDefault();
		const target = event.target as Element | null;
		const el = target?.closest('[data-element-id]');
		const id = el?.getAttribute('data-element-id');
		if (id) {
			onaipickelement?.(id);
		}
	}
	function swallow(event: Event): void {
		event.stopPropagation();
		event.preventDefault();
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
	class:pptx-svelte-ai-picking={pickActive}
	data-pptx-ai-active={aiActive ? 'true' : undefined}
	data-ai-pick-mode={pickActive ? 'true' : undefined}
	style={`width: ${canvasSize.width * scale}px; height: ${canvasSize.height * scale}px; --pptx-grid-size: ${gridSpacingPx}px`}
	onpointerdown={pickActive ? swallow : editingActive ? onstagepointerdown : undefined}
	onpointermove={editingActive && !pickActive ? onstagepointermove : undefined}
	ondblclick={editingActive && !pickActive ? onstagedblclick : undefined}
	oncontextmenu={(editingActive && !pickActive) || presenting ? onstagecontextmenu : undefined}
	onclick={pickActive ? pickFromEvent : onstageclick}
>
	<SlideStage
		{slide}
		{canvasSize}
		{mediaDataUrls}
		{scale}
		{presenting}
		interactive
		{editTemplateMode}
		{editingElementId}
		{ontablecellcommit}
		{onsmartartnodecommit}
		{onsmartartnodefill}
		{onchartpointcommit}
		{ontableresizecolumns}
		{ontableresizerow}
		{comments}
		{oncommentmarkerclick}
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

	.pptx-svelte-ai-picking {
		cursor: crosshair;
	}

	/* While the AI is active, tween colour changes on slide elements so an edit
	   fades from its old value to the new one instead of snapping. Global so it
	   reaches the SlideStage-rendered elements ([data-element-id]) below. */
	:global(.pptx-svelte-stage-holder[data-pptx-ai-active='true'] [data-element-id]),
	:global(.pptx-svelte-stage-holder[data-pptx-ai-active='true'] [data-element-id] *) {
		transition:
			color 0.5s ease,
			fill 0.5s ease,
			stroke 0.5s ease,
			background-color 0.5s ease,
			border-color 0.5s ease;
	}
</style>
