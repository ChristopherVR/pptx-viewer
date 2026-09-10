<script lang="ts">
	/**
	 * The two morph-only layers `PresentationTransitionOverlay.svelte` paints
	 * ABOVE its outgoing/incoming pair, split out to keep that file under the
	 * project's per-file LOC budget:
	 *
	 *  - the **lifted** layer: arriving shapes a ghost above them would
	 *    otherwise hide for the whole morph, painted here so they dissolve in
	 *    where a viewer can see them (issue #146). Their copy on the incoming
	 *    layer is held invisible by the plan, so nothing composites twice.
	 *  - the **crossfade groups**: pairs the overlay paints BOTH halves of, each
	 *    as one isolated group so the halves are SUMMED rather than stacked
	 *    (issue #161).
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import type { MorphCrossfadeGroupView } from './use-morph-transition-overlay.svelte';
	import SlideStage from '../components/SlideStage.svelte';

	const {
		liftedSlide,
		liftedStyle,
		crossfadeGroups,
		canvasSize,
		mediaDataUrls,
		scale = 1,
	}: {
		liftedSlide: PptxSlide | undefined;
		liftedStyle: string;
		crossfadeGroups: readonly MorphCrossfadeGroupView[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		scale?: number;
	} = $props();
</script>

{#if liftedSlide}
	<div
		class="pptx-svelte-transition-layer"
		data-pptx-transition-layer="lifted"
		data-pptx-morph-lifted="true"
		style={liftedStyle}
	>
		<SlideStage slide={liftedSlide} {canvasSize} {mediaDataUrls} {scale} transparentBackground />
	</div>
{/if}
{#each crossfadeGroups as group (group.key)}
	<div data-pptx-morph-crossfade={group.key} style={group.style}>
		<div
			class="pptx-svelte-transition-layer"
			data-pptx-transition-layer="outgoing"
			data-pptx-morph-outgoing="true"
			style={group.outgoingStyle}
		>
			<SlideStage slide={group.outgoing} {canvasSize} {mediaDataUrls} {scale} transparentBackground />
		</div>
		<div
			class="pptx-svelte-transition-layer"
			data-pptx-transition-layer="lifted"
			data-pptx-morph-lifted="true"
			style={group.incomingStyle}
		>
			<SlideStage slide={group.incoming} {canvasSize} {mediaDataUrls} {scale} transparentBackground />
		</div>
	</div>
{/each}

<style>
	/* Same rule as the parent overlay's own `.pptx-svelte-transition-layer`. */
	.pptx-svelte-transition-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		will-change: transform, opacity, clip-path, filter;
	}
</style>
