<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { Extrusion3DData, Extrusion3dCss } from '../composables/visual-3d';

/**
 * Extrusion3DOverlay: Vue port of React's `Extrusion3DOverlay.tsx`.
 *
 * Renders the CSS 3D extrusion side faces (top/bottom/left/right panels) of a
 * shape with `a:sp3d` extrusion depth, using the framework-agnostic panel data
 * from shared `build3DExtrusionData`. Each panel is a plain `<div>` positioned
 * in 3D space around the shape's bounding box to form the sides of the
 * extrusion volume; an optional material gradient overlays the front face.
 *
 * This is purely visual (`pointer-events: none`, `aria-hidden`): no
 * interactivity on the panels. The wrapper establishes its own
 * `transform-style: preserve-3d` + `perspective` context, so it can be dropped
 * straight into the shape box without extra container wiring.
 */
const props = defineProps<{
	/** Extrusion data computed by shared `build3DExtrusionData`. */
	data: Extrusion3DData;
}>();

/**
 * Convert a framework-neutral `Extrusion3dCss` map to a Vue `CSSProperties`.
 *
 * The shared builder returns raw numbers for length values (`width`, `height`,
 * `left`, `top`, `inset`) relying on React's automatic `px` suffixing. Vue's
 * `:style` binding does NOT append units to numbers, so coerce every numeric
 * value to a `px` string here (unitless properties never appear in this data).
 */
function toCss(style: Extrusion3dCss): CSSProperties {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(style)) {
		out[key] = typeof value === 'number' ? `${value}px` : value;
	}
	return out as CSSProperties;
}

const wrapperStyle = computed<CSSProperties>(() => toCss(props.data.wrapperStyle));

const panels = computed(() =>
	props.data.panels.map((panel) => ({ side: panel.side, style: toCss(panel.style) })),
);

const materialOverlayStyle = computed<CSSProperties | null>(() => {
	if (!props.data.materialOverlay) {
		return null;
	}
	return {
		position: 'absolute',
		inset: 0,
		backgroundImage: props.data.materialOverlay,
		pointerEvents: 'none',
		borderRadius: 'inherit',
		transform: props.data.frontFaceStyle.transform as string | undefined,
		transformStyle: 'preserve-3d',
		backfaceVisibility: 'hidden',
		mixBlendMode: 'normal',
	};
});
</script>

<template>
	<div
		v-if="data.hasExtrusion && data.panels.length > 0"
		class="pptx-vue-extrusion-3d-wrapper"
		:style="wrapperStyle"
		aria-hidden="true"
	>
		<div
			v-for="panel in panels"
			:key="panel.side"
			class="pptx-vue-extrusion-3d-panel"
			:class="`pptx-vue-extrusion-3d-panel--${panel.side}`"
			:style="panel.style"
		/>
		<div
			v-if="materialOverlayStyle"
			class="pptx-vue-extrusion-3d-material-overlay"
			:style="materialOverlayStyle"
		/>
	</div>
</template>
