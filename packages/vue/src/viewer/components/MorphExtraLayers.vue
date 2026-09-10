<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';

import type { MorphCrossfadeGroupView } from '../composables/use-morph-transition-overlay';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * The two morph-only layers `PresentationTransitionOverlay.vue` paints ABOVE
 * its outgoing/incoming pair, split out to keep that file under the
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
defineProps<{
	liftedSlide: PptxSlide | undefined;
	liftedLayerStyle: CSSProperties;
	crossfadeGroups: readonly MorphCrossfadeGroupView[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	scale: number;
}>();
</script>

<template>
	<div
		v-if="liftedSlide"
		class="pptx-vue-transition-layer"
		data-pptx-transition-layer="lifted"
		data-pptx-morph-lifted="true"
		:style="liftedLayerStyle"
	>
		<SlideStage
			:slide="liftedSlide"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:scale="scale"
			preserve-element-ids
			transparent-background
		/>
	</div>

	<div
		v-for="group in crossfadeGroups"
		:key="group.key"
		:data-pptx-morph-crossfade="group.key"
		:style="group.style"
	>
		<div
			class="pptx-vue-transition-layer"
			data-pptx-transition-layer="outgoing"
			data-pptx-morph-outgoing="true"
			:style="group.outgoingStyle"
		>
			<SlideStage
				:slide="group.outgoingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				preserve-element-ids
				transparent-background
			/>
		</div>
		<div
			class="pptx-vue-transition-layer"
			data-pptx-transition-layer="lifted"
			data-pptx-morph-lifted="true"
			:style="group.incomingStyle"
		>
			<SlideStage
				:slide="group.incomingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				preserve-element-ids
				transparent-background
			/>
		</div>
	</div>
</template>

<style scoped>
/* Same rule as the parent overlay's own `.pptx-vue-transition-layer`: the
   layer must FILL its ancestor, not shrink-wrap `SlideStage` (which scales
   with a CSS `transform` that never changes its laid-out box). */
.pptx-vue-transition-layer {
	position: absolute;
	inset: 0;
	overflow: hidden;
	will-change: transform, opacity, clip-path, filter;
}
</style>
