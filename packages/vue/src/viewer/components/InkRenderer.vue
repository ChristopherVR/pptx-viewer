<script setup lang="ts">
import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';
import {
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	pressuresToWidths,
} from 'pptx-viewer-shared';
import type { PressureCircle } from 'pptx-viewer-shared';
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
 * Pressure-sensitive variable-width strokes are rendered when the element
 * carries per-point pressure data (`inkPointPressures`) or a legacy per-point
 * `inkWidths` array with variation: each sampled point becomes an SVG `<circle>`
 * whose radius follows the interpolated width (shared `generatePressureCircles`
 * maths), matching React. Strokes without pressure data degrade to plain
 * constant-width `<path>`s.
 *
 * Not ported (TODO): ink replay animation and the
 * highlighter/eraser tool blend modes.
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

interface PathStroke {
	kind: 'path';
	d: string;
	color: string;
	width: number;
	opacity: number;
}

interface PressureStroke {
	kind: 'pressure';
	circles: PressureCircle[];
	color: string;
	opacity: number;
}

type InkStroke = PathStroke | PressureStroke;

/**
 * Build the per-point pressure circles for a stroke, or return null when the
 * stroke has no usable (varying) pressure data and should render as a plain
 * variable-width path instead.
 */
function pressureCirclesFor(
	el: InkPptxElement,
	pathD: string,
	index: number,
	width: number,
): PressureCircle[] | null {
	const config = { baseWidth: width, minRadius: 0.5, maxRadius: width * 1.5 };

	// Prefer per-point pressure from the stylus (inkPointPressures[index]).
	const pointPressures = el.inkPointPressures?.[index];
	if (pointPressures && pointPressures.length > 1 && hasPressureVariation(pointPressures)) {
		const pointWidths = pressuresToWidths(pointPressures, width);
		return generatePressureCircles(extractPathPoints(pathD), pointWidths, config);
	}

	// Legacy fallback: treat the inkWidths array as per-point widths only when it
	// carries more entries than there are paths (so a normal per-path widths array
	// is never mistaken for pressure data) and shows variation.
	const paths = el.inkPaths ?? [];
	if (el.inkWidths && el.inkWidths.length > paths.length && hasPressureVariation(el.inkWidths)) {
		return generatePressureCircles(extractPathPoints(pathD), el.inkWidths, config);
	}

	return null;
}

/** Resolve per-stroke colour/width/opacity and pick path vs. pressure rendering. */
const strokes = computed<InkStroke[]>(() => {
	const el = ink.value;
	if (!el) {
		return [];
	}
	return (el.inkPaths ?? []).map((d, i): InkStroke => {
		const color = el.inkColors?.[i] ?? DEFAULT_STROKE_COLOR;
		const width = el.inkWidths?.[i] ?? 1;
		const opacity = el.inkOpacities?.[i] ?? 1;

		const circles = pressureCirclesFor(el, d, i, width);
		if (circles) {
			return { kind: 'pressure', circles, color, opacity };
		}
		return { kind: 'path', d, color, width, opacity };
	});
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
			<template v-for="(s, i) in strokes" :key="strokeKey(i)">
				<g v-if="s.kind === 'pressure'" :opacity="s.opacity">
					<circle
						v-for="(c, j) in s.circles"
						:key="`${strokeKey(i)}-pc-${j}`"
						:cx="c.cx"
						:cy="c.cy"
						:r="c.r"
						:fill="s.color"
					/>
				</g>
				<path
					v-else
					:d="s.d"
					fill="none"
					:stroke="s.color"
					:stroke-width="s.width"
					:stroke-opacity="s.opacity"
					stroke-linecap="round"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			</template>
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
