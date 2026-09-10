<script lang="ts">
	/**
	 * Renders one `FragmentedLayer` (from `getFragmentedTransitionDescriptor` in
	 * `pptx-viewer-shared`) as N clipped copies of `SlideStage` - the Svelte
	 * mapping of the seven multi-fragment cinematic transitions (`vortex`,
	 * `honeycomb`, `glitter`, `shred`, `fracture`, `curtains`, `airplane`; see
	 * `slide-transition-fragments.ts` in pptx-viewer-shared for the COM
	 * measurement and the pure decision function this maps).
	 *
	 * Every fragment is `position: absolute` + `clip-path` + a shared
	 * `@keyframes` animation (already injected via the transition overlay's
	 * global keyframes block) parameterised by CSS custom properties, so the
	 * whole set stays transform/opacity-only and GPU-composited with no
	 * per-frame JS. Mirrors the React binding's `FragmentedTransitionLayer.tsx`.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import type { CanvasSize, FragmentedLayer, TransitionFragment } from 'pptx-viewer-shared';

	import SlideStage from '../components/SlideStage.svelte';
	import { styleToString } from '../style';

	const {
		layer,
		slide,
		canvasSize,
		mediaDataUrls,
		scale = 1,
		zIndex,
		layerName,
	}: {
		layer: FragmentedLayer;
		slide: PptxSlide | undefined;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		scale?: number;
		zIndex: number;
		layerName: 'outgoing' | 'incoming';
	} = $props();

	function fragmentStyle(fragment: TransitionFragment): string {
		return styleToString({
			position: 'absolute',
			inset: 0,
			clipPath: fragment.clipPath,
			transformOrigin: fragment.transformOrigin,
			animationName: layer.keyframesName,
			animationDuration: `${layer.durationMs}ms`,
			animationTimingFunction: layer.easing,
			animationDelay: `${fragment.delayMs}ms`,
			animationFillMode: 'forwards',
			willChange: 'transform, opacity',
			...fragment.vars,
		});
	}
</script>

<div
	class="pptx-svelte-transition-fragment-layer"
	data-pptx-transition-layer={layerName}
	data-pptx-transition-fragments={layer.keyframesName}
	style={styleToString({ zIndex })}
>
	{#each layer.fragments as fragment (fragment.id)}
		<div data-pptx-transition-fragment={fragment.id} style={fragmentStyle(fragment)}>
			<SlideStage {slide} {canvasSize} {mediaDataUrls} {scale} />
		</div>
	{/each}
</div>

<style>
	.pptx-svelte-transition-fragment-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
</style>
