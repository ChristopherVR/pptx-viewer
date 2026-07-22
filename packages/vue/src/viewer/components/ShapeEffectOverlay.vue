<script setup lang="ts">
/**
 * ShapeEffectOverlay: paints the two shape-effect extras that need their own
 * DOM nodes (the shape's CSS `filter`/`box-shadow`/blend already ride on the
 * shape `<div>` from `element-style.ts`):
 *
 *  1. A DAG fill-overlay tint layer (`ComputedEffectStyle.fillOverlay`): an
 *     absolutely-positioned, blended `<div>` painted over the element rather
 *     than blending the whole element (which would also tint text/children).
 *  2. The soft-edge feather `<filter>` (`a:softEdge`): the shape's CSS `filter`
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
import { getComputedEffectStyle, getSoftEdgeSvgFilter } from 'pptx-viewer-shared';
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
</template>
