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
		applySlideTransitionSound,
		getFragmentedTransitionDescriptor,
		resolveSlideTransition,
		resolveTransitionDurationMs,
	} from 'pptx-viewer-shared';
	import type { CanvasSize, CssStyleMap } from 'pptx-viewer-shared';
	import { onDestroy, onMount } from 'svelte';

	import { playAnimationSound, stopAnimationSound } from './animation-sound';
	import FragmentedTransitionLayer from './FragmentedTransitionLayer.svelte';
	import MorphExtraLayers from './MorphExtraLayers.svelte';
	import { useMorphTransitionOverlay } from './use-morph-transition-overlay.svelte';
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

	/**
	 * Multi-fragment descriptor for the seven cinematic transitions measured
	 * as many independent fragments/particles/panels (vortex, honeycomb,
	 * glitter, shred, fracture, curtains, airplane). `undefined` for every
	 * other type, in which case `animations` above (the single-layer
	 * resolver) drives both layers exactly as before.
	 */
	const fragmented = $derived(
		getFragmentedTransitionDescriptor(
			transition?.type ?? 'none',
			durationMs,
			transition?.direction,
			transition?.spokes,
			transition?.pattern,
		),
	);

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
	 * keyframes (scoped by `data-pptx-morph-incoming`) and the outgoing layer
	 * animates each of its own shapes: gliding onto its counterpart (dissolving
	 * into it when its appearance changed) or fading out in place without one.
	 * See `use-morph-transition-overlay.svelte.ts`.
	 */
	const morph = useMorphTransitionOverlay({
		transition: () => transition,
		outgoingSlide: () => outgoingSlide,
		incomingSlide: () => incomingSlide,
		durationMs: () => durationMs,
	});
	const morphPlan = $derived(morph.morphPlan);
	const morphOutgoingSlide = $derived(morph.morphOutgoingSlide);
	const morphLiftedSlide = $derived(morph.morphLiftedSlide);
	const morphCrossfadeGroups = $derived(morph.morphCrossfadeGroups);
	const morphCss = $derived(morph.morphCss);

	// A layer-wide animation would drag every shape as one block and cancel the
	// morph, so the layers stay unanimated while a plan is active.
	const outgoingZIndex = $derived(morphPlan ? 2 : animations.outgoingOnTop ? 2 : 1);
	const incomingZIndex = $derived(morphPlan ? 1 : animations.outgoingOnTop ? 1 : 2);
	const outgoingStyle = $derived(
		styleToString(layerStyle(morphPlan ? 'none' : animations.outgoing, outgoingZIndex)),
	);
	const incomingStyle = $derived(
		styleToString(layerStyle(morphPlan ? 'none' : animations.incoming, incomingZIndex)),
	);
	const liftedStyle = styleToString(layerStyle('none', 3));

	/**
	 * Play or stop this transition's sound action (`p:sndAc/p:stSnd`/`p:endSnd`)
	 * the instant it starts. `transition.soundPath` is a raw in-archive path;
	 * `mediaDataUrls` is the same Blob-URL cache the load pipeline
	 * pre-populates for it (`collectAnimationSoundPaths`, extended to also
	 * collect a slide transition's own sound). Reuses the per-effect sound
	 * singleton (`animation-sound.ts`) so a transition sound and an animation
	 * sound cannot talk over each other, matching PowerPoint's "one sound
	 * plays at a time" behaviour. NOT stopped on this component's own
	 * destroy: a "Loop Until Next Sound" sound must keep playing across the
	 * static period between this overlay tearing down and the next
	 * transition's own sound action; the presentation controller stops it on
	 * leaving the show.
	 */
	$effect(() => {
		applySlideTransitionSound(transition, (soundPath) => mediaDataUrls.get(soundPath), {
			play: playAnimationSound,
			stop: stopAnimationSound,
		});
	});

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
	{#if !morphPlan && fragmented?.outgoing}
		<FragmentedTransitionLayer
			layer={fragmented.outgoing}
			slide={outgoingSlide}
			{canvasSize}
			{mediaDataUrls}
			{scale}
			zIndex={outgoingZIndex}
			layerName="outgoing"
		/>
	{:else}
		<div
			class="pptx-svelte-transition-layer"
			data-pptx-transition-layer="outgoing"
			data-pptx-morph-outgoing={morphPlan ? 'true' : undefined}
			style={outgoingStyle}
		>
			<!-- transparentBackground during a morph: this layer sits ABOVE the
			     incoming slide and only carries the departing shapes, so painting the
			     outgoing slide's own (always opaque) background here would cover the
			     whole morph with a flat slab for its entire duration. -->
			<SlideStage
				slide={morphPlan ? morphOutgoingSlide : outgoingSlide}
				{canvasSize}
				{mediaDataUrls}
				{scale}
				transparentBackground={Boolean(morphPlan)}
			/>
		</div>
	{/if}
	{#if !morphPlan && fragmented?.incoming}
		<FragmentedTransitionLayer
			layer={fragmented.incoming}
			slide={incomingSlide}
			{canvasSize}
			{mediaDataUrls}
			{scale}
			zIndex={incomingZIndex}
			layerName="incoming"
		/>
	{:else}
		<div
			class="pptx-svelte-transition-layer"
			data-pptx-transition-layer="incoming"
			data-pptx-morph-incoming={morphPlan ? 'true' : undefined}
			style={incomingStyle}
		>
			<SlideStage slide={incomingSlide} {canvasSize} {mediaDataUrls} {scale} />
		</div>
	{/if}
	<!-- The two morph-only extra layers (arriving-above-departing "lifted"
	     shapes, and same-pair crossfade groups) - see `MorphExtraLayers.svelte`. -->
	<MorphExtraLayers
		liftedSlide={morphLiftedSlide}
		{liftedStyle}
		crossfadeGroups={morphCrossfadeGroups}
		{canvasSize}
		{mediaDataUrls}
		{scale}
	/>
</div>

<style>
	.pptx-svelte-transition-overlay {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	/* `inset: 0`, not `top/left: 0`: the stage inside scales with a CSS
	   `transform`, which never changes its laid-out box, so an auto-sized layer
	   measures the deck's NATIVE size (1280x720) while the stage paints the
	   display size (1920x1080). With `overflow: hidden` that cropped every
	   transition to a deck-sized top-left corner and the rest of the screen cut
	   straight to the next slide. Pinning to the overlay (already the frame's
	   scaled footprint) puts the clip on the slide edge, where it belongs. */
	.pptx-svelte-transition-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		will-change: transform, opacity, clip-path, filter;
	}
</style>
