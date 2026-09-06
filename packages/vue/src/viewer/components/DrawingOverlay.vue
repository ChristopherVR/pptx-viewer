<script setup lang="ts">
/**
 * DrawingOverlay: Draw-tab ink capture. When a pen/highlighter/eraser tool is
 * armed, an SVG over the slide (in `SlideStage`'s scaled space) captures pointer
 * strokes: pen/highlighter emit a `stroke` (point list + style) the host turns
 * into an `ink` element; eraser emits `erase` with the slide-space point for the
 * host to hit-test. While the Select tool is active the overlay is
 * `pointer-events: none` so normal selection/drag works. The in-progress stroke
 * is drawn live. Vue counterpart of React's `canvas/DrawingOverlaySvg`.
 */
import type { InkPoint, InkStrokeView } from 'pptx-viewer-shared';
import { buildLiveInkStrokeView, pointFromPointerEvent } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import type { CanvasSize } from '../types';

const props = defineProps<{
	canvasSize: CanvasSize;
	/** True when a drawing tool (not Select) is armed. */
	active: boolean;
	tool: string;
	color: string;
	width: number;
	/** Effective zoom (fitScale × user zoom), to map client px → slide px. */
	scale: number;
}>();

const emit = defineEmits<{
	stroke: [payload: { points: InkPoint[]; color: string; width: number; tool: string }];
	erase: [point: InkPoint];
}>();

const rootRef = ref<SVGSVGElement | null>(null);
const drawing = ref(false);
const points = ref<InkPoint[]>([]);

/**
 * Map a pointer event to a slide-space point, carrying its pressure and tilt
 * reading along (via the shared `pointFromPointerEvent`). `useInkDrawing`'s
 * `addInkStroke` feeds the accumulated points into the shared
 * `strokeToInkElement`, which authors a variable-width `inkPointPressures`
 * channel when pressure genuinely varies, and an `inkPointTiltX`/`inkPointTiltY`
 * channel when the stylus reports a genuine lean, matching React's Draw tool.
 */
function toSlide(e: PointerEvent): InkPoint {
	const rect = rootRef.value?.getBoundingClientRect();
	const s = props.scale || 1;
	return pointFromPointerEvent(
		(e.clientX - (rect?.left ?? 0)) / s,
		(e.clientY - (rect?.top ?? 0)) / s,
		e,
	);
}

function onDown(e: PointerEvent): void {
	if (!props.active) {
		return;
	}
	e.preventDefault();
	e.stopPropagation();
	const p = toSlide(e);
	if (props.tool === 'eraser') {
		emit('erase', p);
		return;
	}
	drawing.value = true;
	points.value = [p];
	(e.target as Element).setPointerCapture?.(e.pointerId);
}
function onMove(e: PointerEvent): void {
	if (!drawing.value) {
		return;
	}
	points.value = [...points.value, toSlide(e)];
}
function onUp(): void {
	if (!drawing.value) {
		return;
	}
	drawing.value = false;
	if (points.value.length > 1) {
		emit('stroke', {
			points: points.value,
			color: props.color,
			width: props.width,
			tool: props.tool,
		});
	}
	points.value = [];
}

/** Polyline path from the captured points. */
const livePath = computed(() => {
	const pts = points.value;
	if (pts.length === 0) {
		return '';
	}
	return `M ${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`;
});
const isHighlighter = computed(() => props.tool === 'highlighter');
// Matches `useInkDrawing.addInkStroke`'s own highlighter width multiplier, so
// the live preview's stroke width is the SAME one the committed element will
// get, not merely the same shape.
const liveWidth = computed(() => (isHighlighter.value ? props.width * 3 : props.width));
const liveOpacity = computed(() => (isHighlighter.value ? 0.4 : 1));

/**
 * The in-progress stroke's render view (plain path, pressure circles, or
 * tilt nib marks), from the shared `buildLiveInkStrokeView`: the same
 * decision `InkRenderer.vue` makes for a committed stroke (via
 * `buildInkGroupStrokes`), fed the SAME accumulated per-point pressure/tilt
 * `points` the eventual `stroke` event carries to `strokeToInkElement`. `null`
 * while idle.
 */
const liveStrokeView = computed<InkStrokeView | null>(() =>
	buildLiveInkStrokeView({
		points: points.value,
		color: props.color,
		width: liveWidth.value,
		tool: props.tool === 'freeform' ? 'freeform' : isHighlighter.value ? 'highlighter' : 'pen',
	}),
);
</script>

<template>
	<svg
		ref="rootRef"
		class="absolute inset-0 z-[5]"
		:width="canvasSize.width"
		:height="canvasSize.height"
		:viewBox="`0 0 ${canvasSize.width} ${canvasSize.height}`"
		:style="{ pointerEvents: active ? 'auto' : 'none', cursor: active ? 'crosshair' : 'default' }"
		@pointerdown="onDown"
		@pointermove="onMove"
		@pointerup="onUp"
		@pointerleave="onUp"
	>
		<!--
			Live stroke preview: same `InkStrokeView` decision a committed stroke
			gets (nib marks / pressure circles / plain path), so a calligraphic
			lean or pressure-variable width shows up while the pointer is still
			down. Falls back to a plain path built straight from `livePath` only
			when there is a path but the view hasn't been built yet (defensive;
			both derive from the same `points`).
		-->
		<template v-if="liveStrokeView">
			<g v-if="liveStrokeView.nibMarks" :opacity="liveStrokeView.opacity">
				<ellipse
					v-for="(m, j) in liveStrokeView.nibMarks"
					:key="`live-nib-${j}`"
					:cx="m.cx"
					:cy="m.cy"
					:rx="m.rPerp"
					:ry="m.rTilt"
					:transform="`rotate(${m.rotationDeg} ${m.cx} ${m.cy})`"
					:fill="liveStrokeView.color"
				/>
			</g>
			<g v-else-if="liveStrokeView.circles" :opacity="liveStrokeView.opacity">
				<circle
					v-for="(c, j) in liveStrokeView.circles"
					:key="`live-pc-${j}`"
					:cx="c.cx"
					:cy="c.cy"
					:r="c.r"
					:fill="liveStrokeView.color"
				/>
			</g>
			<path
				v-else
				:d="liveStrokeView.d"
				fill="none"
				:stroke="liveStrokeView.color"
				:stroke-width="liveStrokeView.width"
				stroke-linecap="round"
				stroke-linejoin="round"
				:opacity="liveStrokeView.opacity"
			/>
		</template>
		<path
			v-else-if="livePath"
			:d="livePath"
			fill="none"
			:stroke="color"
			:stroke-width="liveWidth"
			stroke-linecap="round"
			stroke-linejoin="round"
			:opacity="liveOpacity"
		/>
	</svg>
</template>
