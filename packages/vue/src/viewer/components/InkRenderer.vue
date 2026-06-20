<script setup lang="ts">
import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import { DEFAULT_STROKE_COLOR } from '../constants';

/**
 * InkRenderer: Vue port of the React `renderInk` (in `InkGroupRenderers.tsx`),
 * viewer-first subset.
 *
 * Renders freehand ink strokes (`InkPptxElement.inkPaths`) as inline SVG
 * `<path>` elements inside the element's bounding box, with per-stroke colour,
 * width, and opacity resolved from the parallel `inkColors`/`inkWidths`/
 * `inkOpacities` arrays.
 *
 * Not ported (TODO, see PORTING.md): pressure-sensitive variable-width strokes
 * (`inkPointPressures`), ink replay animation, and the highlighter/eraser tool
 * blend modes. These all degrade gracefully to plain constant-width strokes.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const ink = computed<InkPptxElement | undefined>(() =>
	isInkElement(props.element) ? props.element : undefined,
);

const viewBoxW = computed(() => Math.max(props.element.width, 1));
const viewBoxH = computed(() => Math.max(props.element.height, 1));

interface InkStroke {
	d: string;
	color: string;
	width: number;
	opacity: number;
}

/** Resolve per-stroke colour/width/opacity from the parallel arrays. */
const strokes = computed<InkStroke[]>(() => {
	const el = ink.value;
	if (!el) {
		return [];
	}
	return (el.inkPaths ?? []).map((d, i) => ({
		d,
		color: el.inkColors?.[i] ?? DEFAULT_STROKE_COLOR,
		width: el.inkWidths?.[i] ?? 1,
		opacity: el.inkOpacities?.[i] ?? 1,
	}));
});

const strokeKey = (i: number): string => `${props.element.id}-ink-${i}`;
</script>

<template>
	<div class="pptx-vue-element pptx-vue-ink" :style="containerStyle" :data-element-id="element.id">
		<svg
			v-if="strokes.length > 0"
			class="pptx-vue-ink-svg"
			:viewBox="`0 0 ${viewBoxW} ${viewBoxH}`"
			preserveAspectRatio="none"
		>
			<path
				v-for="(s, i) in strokes"
				:key="strokeKey(i)"
				:d="s.d"
				fill="none"
				:stroke="s.color"
				:stroke-width="s.width"
				:stroke-opacity="s.opacity"
				stroke-linecap="round"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
	</div>
</template>

<style scoped>
.pptx-vue-ink-svg {
	width: 100%;
	height: 100%;
	pointer-events: none;
	display: block;
}
</style>
