<script lang="ts">
	/**
	 * PresentationTransitionOverlay: animates a slide change in presentation mode
	 * (Svelte port of the Vue overlay of the same name). It stacks two
	 * {@link SlideStage} layers, both scaled identically to the underlying
	 * presentation frame:
	 *   - the outgoing (old) slide as a snapshot layer, and
	 *   - the incoming (new) slide.
	 *
	 * The incoming slide's transition is mapped to CSS `animation` shorthands via
	 * the framework-agnostic {@link resolveSlideTransition}; each layer's z-index
	 * comes from `outgoingOnTop`. When the configured duration elapses it calls
	 * `ondone`, at which point the host drops the overlay and leaves the static
	 * incoming slide rendered by its main stage. The `@keyframes` themselves are
	 * injected once at document level (see `keyframes.ts`).
	 */
	import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
	import {
		buildMorphScopedCss,
		buildMorphTransitionPlan,
		morphOptionToMode,
		resolveSlideTransition,
		resolveTransitionDurationMs,
	} from 'pptx-viewer-shared';
	import type { CanvasSize, CssStyleMap } from 'pptx-viewer-shared';
	import { onDestroy, onMount } from 'svelte';

	import SlideStage from '../components/SlideStage.svelte';
	import { styleToString } from '../style';

	const {
		outgoingSlide,
		incomingSlide,
		canvasSize,
		mediaDataUrls,
		scale = 1,
		transition,
		ondone,
	}: {
		outgoingSlide: PptxSlide | undefined;
		incomingSlide: PptxSlide | undefined;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		scale?: number;
		transition: PptxSlideTransition | undefined;
		ondone: () => void;
	} = $props();

	const animations = $derived(resolveSlideTransition(transition));
	/** Effective duration (ms); `0` for instant (none/cut). */
	const durationMs = $derived(resolveTransitionDurationMs(transition));

	function layerStyle(animation: string, zIndex: number): CssStyleMap {
		const style: CssStyleMap = { zIndex };
		if (animation !== 'none') {
			style.animation = animation;
		}
		return style;
	}

	/**
	 * Morph moves individual shapes between the two slides rather than wiping the
	 * whole surface, so when it is active the incoming layer plays per-element
	 * keyframes (scoped by `data-pptx-morph-incoming`) and the outgoing layer is
	 * reduced to just the shapes with no counterpart, fading out.
	 */
	const morphPlan = $derived(
		transition?.type === 'morph'
			? buildMorphTransitionPlan(
					outgoingSlide,
					incomingSlide,
					durationMs,
					morphOptionToMode(transition.morphOption),
				)
			: undefined,
	);

	const morphOutgoingSlide = $derived(
		morphPlan && outgoingSlide ? { ...outgoingSlide, elements: morphPlan.outgoingElements } : undefined,
	);

	const morphCss = $derived(
		morphPlan
			? [
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-incoming', 'incoming'),
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-outgoing', 'outgoing'),
				].join('\n')
			: '',
	);

	// A layer-wide animation would drag every shape as one block and cancel the
	// morph, so the layers stay unanimated while a plan is active.
	const outgoingStyle = $derived(
		styleToString(layerStyle(morphPlan ? 'none' : animations.outgoing, morphPlan ? 2 : animations.outgoingOnTop ? 2 : 1)),
	);
	const incomingStyle = $derived(
		styleToString(layerStyle(morphPlan ? 'none' : animations.incoming, morphPlan ? 1 : animations.outgoingOnTop ? 1 : 2)),
	);

	let timer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		// A small buffer past the animation duration lets the CSS `forwards` fill
		// settle before the host swaps back to the static slide.
		timer = setTimeout(
			() => {
				timer = null;
				ondone();
			},
			Math.max(0, durationMs) + 50,
		);
	});

	onDestroy(() => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	});
</script>

<div class="pptx-svelte-transition-overlay" data-pptx-transition-overlay>
	{#if morphPlan}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated keyframes, no user input -->
		{@html `<style>${morphCss}</style>`}
	{/if}
	<div
		class="pptx-svelte-transition-layer"
		data-pptx-transition-layer="outgoing"
		data-pptx-morph-outgoing={morphPlan ? 'true' : undefined}
		style={outgoingStyle}
	>
		<SlideStage
			slide={morphPlan ? morphOutgoingSlide : outgoingSlide}
			{canvasSize}
			{mediaDataUrls}
			{scale}
		/>
	</div>
	<div
		class="pptx-svelte-transition-layer"
		data-pptx-transition-layer="incoming"
		data-pptx-morph-incoming={morphPlan ? 'true' : undefined}
		style={incomingStyle}
	>
		<SlideStage slide={incomingSlide} {canvasSize} {mediaDataUrls} {scale} />
	</div>
</div>

<style>
	.pptx-svelte-transition-overlay {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.pptx-svelte-transition-layer {
		position: absolute;
		top: 0;
		left: 0;
		overflow: hidden;
		will-change: transform, opacity, clip-path, filter;
	}
</style>
