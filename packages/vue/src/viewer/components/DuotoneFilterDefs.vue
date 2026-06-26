<script setup lang="ts">
/**
 * DuotoneFilterDefs: injects the hidden SVG `<filter>` definition that backs a
 * shape-level effect-DAG duotone (`a:effectDag` duotone) effect.
 *
 * The shape's CSS `filter` (built in `element-style.ts`) carries a
 * `url(#dag-duotone-<id>)` reference; this component renders the matching
 * `<filter>` markup (from shared `getDuotoneSvgFilter`) into a hidden,
 * zero-size `<svg><defs>` so that reference resolves. Renders nothing when the
 * element has no shape properties or no `dagDuotone`.
 *
 * Mirrors React's `renderDagDuotoneFilterForElement` and Angular's
 * `duotone-filter` def injection, reusing the same shared filter builder.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { getDuotoneSvgFilter } from 'pptx-viewer-shared';
import { computed } from 'vue';

const props = defineProps<{
	element: PptxElement;
}>();

/**
 * The duotone `<filter>` definition for this element, or `undefined` when no
 * shape-level duotone applies. The `filterMarkup` is a complete
 * `<filter id="dag-duotone-<id>">…</filter>` element injected via `v-html`.
 */
const duotone = computed(() => {
	if (!hasShapeProperties(props.element)) {
		return undefined;
	}
	const ss = props.element.shapeStyle;
	if (!ss?.dagDuotone) {
		return undefined;
	}
	return getDuotoneSvgFilter(ss, props.element.id);
});
</script>

<template>
	<svg
		v-if="duotone"
		width="0"
		height="0"
		aria-hidden="true"
		style="position: absolute; width: 0; height: 0; overflow: hidden"
	>
		<defs v-html="duotone.filterMarkup" />
	</svg>
</template>
