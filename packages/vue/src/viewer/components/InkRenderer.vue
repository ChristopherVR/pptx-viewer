<script setup lang="ts">
import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';
import { buildInkGroupStrokes, getInkReplayStyles, INK_REPLAY_KEYFRAMES } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, watchEffect } from 'vue';

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
 * The per-stroke view model (path vs pressure circles vs tilt-driven nib
 * marks) is the shared `buildInkGroupStrokes` decision function, the same one
 * `ContentPartRenderer.vue` uses for a loaded `p:contentPart`: pressure comes
 * from `inkPointPressures` (or a legacy per-point `inkWidths` array), tilt
 * from `inkPointTiltX`/`inkPointTiltY`. Strokes without either degrade to a
 * plain constant-width `<path>`.
 *
 * Presentation mode progressively replays constant-width paths using the
 * shared dash-offset timing model. Pressure circles and nib marks remain
 * static because SVG dash replay only applies to paths.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
	replay?: boolean;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const ink = computed<InkPptxElement | undefined>(() =>
	isInkElement(props.element) ? props.element : undefined,
);

const viewBoxW = computed(() => Math.max(props.element.width, 1));
const viewBoxH = computed(() => Math.max(props.element.height, 1));

/** Per-stroke view model: plain path, pressure circles, or tilt nib marks. */
const strokes = computed(() => {
	const el = ink.value;
	if (!el) {
		return [];
	}
	return buildInkGroupStrokes(el, { color: DEFAULT_STROKE_COLOR, width: 1 });
});
const replayStyles = computed(() =>
	props.replay && ink.value ? getInkReplayStyles(ink.value) : [],
);
watchEffect((onCleanup) => {
	if (!props.replay || typeof document === 'undefined') {
		return;
	}
	const style = document.createElement('style');
	style.dataset.pptxInkReplay = props.element.id;
	style.textContent = INK_REPLAY_KEYFRAMES;
	document.head.appendChild(style);
	onCleanup(() => style.remove());
});
function replayStyle(index: number): CSSProperties | undefined {
	const replay = replayStyles.value[index];
	return replay
		? {
				animation: replay.animation,
				strokeDasharray: replay.strokeDasharray,
				strokeDashoffset: replay.strokeDashoffset,
				'--ink-path-length': String(replay.pathLength),
			}
		: undefined;
}
</script>

<template>
	<div class="pptx-vue-element pptx-vue-ink" :style="containerStyle" :data-element-id="element.id">
		<svg
			v-if="strokes.length > 0"
			class="pptx-vue-ink-svg"
			:viewBox="`0 0 ${viewBoxW} ${viewBoxH}`"
			preserveAspectRatio="none"
		>
			<template v-for="(s, i) in strokes" :key="s.key">
				<g v-if="s.nibMarks" :opacity="s.opacity">
					<ellipse
						v-for="(m, j) in s.nibMarks"
						:key="`${s.key}-nib-${j}`"
						:cx="m.cx"
						:cy="m.cy"
						:rx="m.rPerp"
						:ry="m.rTilt"
						:transform="`rotate(${m.rotationDeg} ${m.cx} ${m.cy})`"
						:fill="s.color"
					/>
				</g>
				<g v-else-if="s.circles" :opacity="s.opacity">
					<circle
						v-for="(c, j) in s.circles"
						:key="`${s.key}-pc-${j}`"
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
					:style="replayStyle(i)"
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
