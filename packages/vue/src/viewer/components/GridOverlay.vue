<script setup lang="ts">
/**
 * GridOverlay — Vue port of React's `canvas/GridOverlay.tsx`.
 *
 * A subtle dot grid drawn over the slide via an SVG `<pattern>`, matching
 * PowerPoint's grid display. Rendered inside `SlideStage`'s scaled space (sized
 * to the unscaled canvas), so it lines up with the slide content at any zoom.
 * Purely decorative — `pointer-events-none` so it never intercepts editing.
 */
import { computed } from 'vue';

import type { CanvasSize } from '../types';

const props = withDefaults(
	defineProps<{
		canvasSize: CanvasSize;
		visible: boolean;
		/** Grid spacing in CSS px. Defaults to GRID_SIZE (8), matching React. */
		gridSpacingPx?: number;
	}>(),
	{ gridSpacingPx: 8 },
);

const spacing = computed(() => Math.max(props.gridSpacingPx, 2));
// Unique pattern id so multiple viewers on one page don't collide.
const patternId = `grid-dot-pattern-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
	<svg
		v-if="visible"
		class="absolute inset-0 pointer-events-none z-[2]"
		:width="canvasSize.width"
		:height="canvasSize.height"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<defs>
			<pattern :id="patternId" :width="spacing" :height="spacing" patternUnits="userSpaceOnUse">
				<circle :cx="spacing / 2" :cy="spacing / 2" r="0.6" fill="rgba(156, 163, 175, 0.55)" />
			</pattern>
		</defs>
		<rect :width="canvasSize.width" :height="canvasSize.height" :fill="`url(#${patternId})`" />
	</svg>
</template>
