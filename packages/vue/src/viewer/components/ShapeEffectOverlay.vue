<script setup lang="ts">
/**
 * ShapeEffectOverlay: paints the two shape-effect extras that need their own
 * DOM nodes (the shape's CSS `filter`/`box-shadow`/blend already ride on the
 * shape `<div>` from `element-style.ts`):
 *
 *  1. A DAG fill-overlay tint layer (`ComputedEffectStyle.fillOverlay`): an
 *     absolutely-positioned, blended `<div>` painted over the element rather
 *     than blending the whole element (which would also tint text/children).
 *  2. A stroked SVG OUTLINE, for the two cases a CSS `border` cannot paint: a
 *     gradient / pattern line (`a:ln/a:gradFill`, `a:ln/a:pattFill`), which a
 *     border can only render as one flat colour, and a stroke-only ("open")
 *     preset such as `line` or `arc`, which has no box to put a border on. Both
 *     follow the shape's own geometry; `element-style.ts` drops the CSS border
 *     for these shapes so the averaged solid (or a rectangle) cannot show
 *     underneath.
 *  3. The soft-edge feather `<filter>` (`a:softEdge`): the shape's CSS `filter`
 *     already carries a `url(#soft-edge-<id>)` reference (emitted by shared
 *     `getEffectFilterCss`); this injects the matching `<filter>` markup into a
 *     hidden, zero-size `<svg><defs>` so that reference resolves. Mirrors how
 *     {@link DuotoneFilterDefs} injects the duotone filter.
 *
 * Renders nothing when the element has no shape properties, no fill overlay,
 * and no soft edge.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	buildStrokeOutline,
	getComputedEffectStyle,
	getSoftEdgeSvgFilter,
	strokeOutlineViewBox,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

const props = defineProps<{ element: PptxElement }>();

/** Combined shape effect style; `fillOverlay` is the only field read here. */
const effect = computed(() => getComputedEffectStyle(props.element));

/**
 * Absolutely-positioned tint layer style, or `undefined` when the element has
 * no DAG fill overlay. Painted over the whole element box with the overlay's
 * own `mix-blend-mode`.
 */
const fillOverlayStyle = computed<CSSProperties | undefined>(() => {
	const overlay = effect.value.fillOverlay;
	if (!overlay) {
		return undefined;
	}
	return {
		position: 'absolute',
		inset: '0',
		background: overlay.color,
		mixBlendMode: overlay.blendMode as CSSProperties['mixBlendMode'],
		pointerEvents: 'none',
	};
});

/**
 * The soft-edge `<filter>` definition for this element, or `undefined` when no
 * soft edge applies. The `filterMarkup` is a complete
 * `<filter id="soft-edge-<id>">…</filter>` element injected via `v-html`.
 */
const softEdge = computed(() => {
	if (!hasShapeProperties(props.element)) {
		return undefined;
	}
	return getSoftEdgeSvgFilter(props.element.shapeStyle, props.element.id);
});

/**
 * Stroked SVG outline for a gradient `a:ln` or a stroke-only preset, or
 * `undefined` when the CSS border is correct (a closed shape, solid line).
 */
const strokeOutline = computed(() => buildStrokeOutline(props.element));

/** viewBox in the element's PAINTED box, which the path data is authored in. */
const outlineViewBox = computed(() => strokeOutlineViewBox(props.element));
</script>

<template>
	<svg
		v-if="softEdge"
		width="0"
		height="0"
		aria-hidden="true"
		style="position: absolute; width: 0; height: 0; overflow: hidden"
	>
		<defs v-html="softEdge.filterMarkup" />
	</svg>
	<div
		v-if="fillOverlayStyle"
		class="pptx-vue-fill-overlay"
		aria-hidden="true"
		:style="fillOverlayStyle"
	/>
	<svg
		v-if="strokeOutline"
		class="pptx-vue-gradient-outline"
		aria-hidden="true"
		:viewBox="outlineViewBox"
		preserveAspectRatio="none"
		style="
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			overflow: visible;
			pointer-events: none;
		"
	>
		<defs v-if="strokeOutline.paint">
			<pattern
				v-if="strokeOutline.paint.kind === 'pattern'"
				:id="strokeOutline.paint.id"
				:width="strokeOutline.paint.width"
				:height="strokeOutline.paint.height"
				patternUnits="userSpaceOnUse"
			>
				<image
					:href="strokeOutline.paint.href"
					:width="strokeOutline.paint.width"
					:height="strokeOutline.paint.height"
				/>
			</pattern>
			<radialGradient
				v-else-if="strokeOutline.paint.kind === 'radial'"
				:id="strokeOutline.paint.id"
				:cx="strokeOutline.paint.cx"
				:cy="strokeOutline.paint.cy"
				:r="strokeOutline.paint.r"
			>
				<stop
					v-for="(stop, idx) in strokeOutline.paint.stops"
					:key="idx"
					:offset="stop.offset"
					:stop-color="stop.color"
					:stop-opacity="stop.opacity"
				/>
			</radialGradient>
			<linearGradient
				v-else
				:id="strokeOutline.paint.id"
				:x1="strokeOutline.paint.x1"
				:y1="strokeOutline.paint.y1"
				:x2="strokeOutline.paint.x2"
				:y2="strokeOutline.paint.y2"
			>
				<stop
					v-for="(stop, idx) in strokeOutline.paint.stops"
					:key="idx"
					:offset="stop.offset"
					:stop-color="stop.color"
					:stop-opacity="stop.opacity"
				/>
			</linearGradient>
		</defs>
		<path
			v-for="(strand, idx) in strokeOutline.strands"
			:key="idx"
			:d="strokeOutline.d"
			fill="none"
			:stroke="strokeOutline.stroke"
			:stroke-width="strand.strokeWidth"
			:stroke-dasharray="strokeOutline.dashArray"
			:stroke-linecap="strokeOutline.lineCap"
			:stroke-linejoin="strokeOutline.lineJoin"
			:style="strand.offset !== 0 ? { transform: `translate(0, ${strand.offset}px)` } : undefined"
		/>
	</svg>
</template>
