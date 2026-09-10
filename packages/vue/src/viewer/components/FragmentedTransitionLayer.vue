<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import type { FragmentedLayer, TransitionFragment } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * FragmentedTransitionLayer - renders one `FragmentedLayer` (from
 * `getFragmentedTransitionDescriptor` in `pptx-viewer-shared`) as N clipped
 * copies of `SlideStage` - the Vue mapping of the seven multi-fragment
 * cinematic transitions (`vortex`, `honeycomb`, `glitter`, `shred`,
 * `fracture`, `curtains`, `airplane`; see `slide-transition-fragments.ts` in
 * `pptx-viewer-shared` for the COM measurement and the pure decision
 * function this maps).
 *
 * Every fragment is `position:absolute` + `clip-path` + a shared
 * `@keyframes` animation (already folded into the injected
 * `SLIDE_TRANSITION_KEYFRAMES_CSS` aggregate) parameterised by CSS custom
 * properties, so the whole set stays transform/opacity-only and
 * GPU-composited with no per-frame JS.
 *
 * Mounted by `PresentationTransitionOverlay.vue` INSIDE its existing
 * `data-pptx-transition-layer` wrapper, in place of a single `SlideStage`,
 * so the outer wrapper's z-index/`data-pptx-transition-fragments` marker are
 * unaffected by this split.
 */
const props = defineProps<{
	layer: FragmentedLayer;
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	scale: number;
	layerName: 'outgoing' | 'incoming';
}>();

function fragmentKey(fragment: TransitionFragment): string {
	return `${props.layerName}-${fragment.id}`;
}

function fragmentStyle(fragment: TransitionFragment): CSSProperties {
	return {
		clipPath: fragment.clipPath,
		transformOrigin: fragment.transformOrigin,
		animationName: props.layer.keyframesName,
		animationDuration: `${props.layer.durationMs}ms`,
		animationTimingFunction: props.layer.easing,
		animationDelay: `${fragment.delayMs}ms`,
		animationFillMode: 'forwards',
		willChange: 'transform, opacity',
		...fragment.vars,
	} as CSSProperties;
}
</script>

<template>
	<div
		v-for="fragment in layer.fragments"
		:key="fragmentKey(fragment)"
		:data-pptx-transition-fragment="fragment.id"
		class="pptx-vue-transition-fragment"
		:style="fragmentStyle(fragment)"
	>
		<SlideStage
			:slide="slide"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:scale="scale"
		/>
	</div>
</template>

<style scoped>
.pptx-vue-transition-fragment {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
}
</style>
