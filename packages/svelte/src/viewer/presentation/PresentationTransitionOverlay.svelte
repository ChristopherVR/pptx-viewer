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
		MORPH_CROSSFADE_GROUP_CSS_TEXT,
		MORPH_CROSSFADE_HALF_BLEND_MODE,
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
	 * keyframes (scoped by `data-pptx-morph-incoming`) and the outgoing layer
	 * animates each of its own shapes: gliding onto its counterpart (dissolving
	 * into it when its appearance changed) or fading out in place without one.
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

	/**
	 * The arriving shapes a ghost above them would otherwise hide for the whole
	 * morph, painted in their own layer over the departing one (issue #146).
	 * Their copy on the incoming layer is held invisible by the plan, so the two
	 * never composite with each other.
	 */
	const morphLiftedSlide = $derived(
		morphPlan && incomingSlide && morphPlan.overlayIncomingElements.length > 0
			? { ...incomingSlide, elements: morphPlan.overlayIncomingElements }
			: undefined,
	);

	/**
	 * The pairs the overlay paints BOTH halves of, each as one isolated group so
	 * the halves are summed rather than stacked: two source-over fades leave the
	 * ink they share at 0.75 of full strength mid-transition, biting chunks out
	 * of glyphs that cross during a text dissolve, where PowerPoint's own blend
	 * keeps the two coefficients summing to 1.0 (issue #161).
	 */
	const morphCrossfadeGroups = $derived(
		morphPlan && outgoingSlide && incomingSlide
			? morphPlan.crossfadeGroups.map((group, index) => ({
					key: group.incoming.id,
					// `isolation` makes the group a stacking context, so it carries its
					// own z-index to stay above the ghosts its halves came from.
					style: `${MORPH_CROSSFADE_GROUP_CSS_TEXT} z-index: ${4 + index};`,
					outgoing: { ...outgoingSlide, elements: [group.outgoing] },
					incoming: { ...incomingSlide, elements: [group.incoming] },
				}))
			: [],
	);

	const crossfadeHalfStyle = `mix-blend-mode: ${MORPH_CROSSFADE_HALF_BLEND_MODE};`;

	const morphCss = $derived(
		morphPlan
			? [
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-incoming', 'incoming'),
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-outgoing', 'outgoing'),
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-lifted', 'lifted'),
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
	const liftedStyle = styleToString(layerStyle('none', 3));

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
	<div
		class="pptx-svelte-transition-layer"
		data-pptx-transition-layer="incoming"
		data-pptx-morph-incoming={morphPlan ? 'true' : undefined}
		style={incomingStyle}
	>
		<SlideStage slide={incomingSlide} {canvasSize} {mediaDataUrls} {scale} />
	</div>
	{#if morphLiftedSlide}
		<!-- The arriving shapes that dissolve in ABOVE a departing one. They live
		     on the incoming slide, so the layer below draws them under the
		     departing layer, where nobody would see them. -->
		<div
			class="pptx-svelte-transition-layer"
			data-pptx-transition-layer="lifted"
			data-pptx-morph-lifted="true"
			style={liftedStyle}
		>
			<SlideStage slide={morphLiftedSlide} {canvasSize} {mediaDataUrls} {scale} transparentBackground />
		</div>
	{/if}
	<!-- A pair dissolving in place, painted as ONE isolated group whose two
	     halves sum instead of stacking (issue #161). -->
	{#each morphCrossfadeGroups as group (group.key)}
		<div data-pptx-morph-crossfade={group.key} style={group.style}>
			<div
				class="pptx-svelte-transition-layer"
				data-pptx-transition-layer="outgoing"
				data-pptx-morph-outgoing="true"
				style={crossfadeHalfStyle}
			>
				<SlideStage slide={group.outgoing} {canvasSize} {mediaDataUrls} {scale} transparentBackground />
			</div>
			<div
				class="pptx-svelte-transition-layer"
				data-pptx-transition-layer="lifted"
				data-pptx-morph-lifted="true"
				style={crossfadeHalfStyle}
			>
				<SlideStage slide={group.incoming} {canvasSize} {mediaDataUrls} {scale} transparentBackground />
			</div>
		</div>
	{/each}
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
