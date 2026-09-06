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
 *  4. A per-sub-path FILL overlay, for a multi-sub-path preset (`smileyFace`'s
 *     open eyes, `actionButtonBlank`'s darkened bevel well) whose sub-paths
 *     cannot share one CSS `background-color`: `element-style.ts` drops the
 *     container fill for these (via shared `suppressesCssFill`) so this layered
 *     SVG paints it instead, each sub-path with its own resolved fill.
 *  5. A mirrored REFLECTION sibling (`a:reflection`): cross-browser (unlike the
 *     `-webkit-box-reflect` `element-style.ts` used to set, which Firefox never
 *     implemented), painted with a full inert clone of the element's own
 *     rendered content (`ReflectionMirrorContent`: fill, outline, its text
 *     body, and - for a group - its children), not just its resolved fill.
 *
 * A group has no `shapeStyle` of its own, so the fill-overlay/outline extras
 * above stay `undefined` for one (their own builders self-guard on
 * `hasShapeProperties`), but `p:grpSpPr/a:effectLst` DOES resolve a soft edge
 * and a reflection (from `groupEffectStyle`, see shared `getComputedEffectStyle`
 * / `getEffectStyleSource`); the reflection mirrors the whole group subtree,
 * the soft edge feathers the group's own composited raster (its shadow/glow
 * ride the container `filter` set by `element-style.ts`, not this overlay).
 *
 * Renders nothing when the element has no fill overlay, soft edge, stroke
 * outline, hollow hit band, sub-path fill, or reflection.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	buildStrokeOutline,
	buildSubpathFillOverlay,
	getComputedEffectStyle,
	getEffectStyleSource,
	getSoftEdgeSvgFilter,
	buildHollowHitOutline,
	strokeOutlineViewBox,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import ReflectionMirrorContent from './ReflectionMirrorContent.vue';

const props = defineProps<{
	element: PptxElement;
	/** Only needed to resolve a reflected picture's `<img>` src (lazy-loaded pictures). */
	mediaDataUrls?: Map<string, string>;
	/**
	 * Do not render this element's own reflection mirror. Set by
	 * `ReflectionMirrorContent` while it is itself rendering AS a reflection
	 * mirror's content, so a mirror never grows a mirror of itself.
	 */
	suppressReflection?: boolean;
}>();

/**
 * Per-sub-path fill overlay for a multi-sub-path preset or custom geometry, or
 * `undefined` when a single merged fill is correct (the ordinary case).
 */
const subpathFill = computed(() => buildSubpathFillOverlay(props.element));

/** `viewBox` for the sub-path fill overlay, in its own coordinate space. */
const subpathFillViewBox = computed(() => {
	const overlay = subpathFill.value;
	return overlay ? `0 0 ${overlay.viewBoxWidth} ${overlay.viewBoxHeight}` : undefined;
});

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
	return getSoftEdgeSvgFilter(getEffectStyleSource(props.element), props.element.id);
});

/**
 * Stroked SVG outline for a gradient `a:ln` or a stroke-only preset, or
 * `undefined` when the CSS border is correct (a closed shape, solid line).
 */
const strokeOutline = computed(() => buildStrokeOutline(props.element));

/**
 * Transparent outline hit band for an unfilled, textless shape. Its container is
 * `pointer-events: none` so clicks fall through to whatever it is drawn over;
 * this opts the OUTLINE back in (same trick as connector-hit-target).
 */
const hollowHit = computed(() => buildHollowHitOutline(props.element));

/** viewBox in the element's PAINTED box, which the path data is authored in. */
const outlineViewBox = computed(() => strokeOutlineViewBox(props.element));

/**
 * `a:reflection` mirrored-sibling wrapper style, or `undefined` when the
 * element has no reflection (or this instance is itself painting AS a
 * mirror's content, via `suppressReflection`). Cross-browser (unlike the
 * `-webkit-box-reflect` `element-style.ts` used to set): see shared's
 * `getReflectionWrapperStyle`.
 */
const reflection = computed<CSSProperties | undefined>(() =>
	props.suppressReflection ? undefined : (effect.value.reflection as CSSProperties | undefined),
);
</script>

<template>
	<svg
		v-if="subpathFill"
		class="pptx-vue-subpath-fill"
		aria-hidden="true"
		:viewBox="subpathFillViewBox"
		preserveAspectRatio="none"
		style="position: absolute; inset: 0; width: 100%; height: 100%"
	>
		<path
			v-for="(paint, idx) in subpathFill.paints"
			:key="idx"
			:d="paint.d"
			:fill="paint.fill"
			stroke="none"
		/>
	</svg>
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
			<pattern
				v-else-if="strokeOutline.paint.kind === 'rectPath'"
				:id="strokeOutline.paint.id"
				patternUnits="objectBoundingBox"
				width="1"
				height="1"
			>
				<image
					:href="strokeOutline.paint.href"
					x="0"
					y="0"
					width="1"
					height="1"
					preserveAspectRatio="none"
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
	<svg
		v-if="hollowHit"
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
		<path
			:d="hollowHit.d"
			fill="none"
			stroke="transparent"
			:stroke-width="hollowHit.strokeWidth"
			style="pointer-events: stroke"
		/>
	</svg>
	<div v-if="reflection" class="pptx-vue-reflection" aria-hidden="true" :style="reflection">
		<ReflectionMirrorContent :element="element" :media-data-urls="mediaDataUrls" />
	</div>
</template>
