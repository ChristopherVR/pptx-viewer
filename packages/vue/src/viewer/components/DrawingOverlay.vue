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
import type { InkPoint } from 'pptx-viewer-shared';
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
 * Map a pointer event to a slide-space point, carrying its pressure reading
 * along (`PointerEvent.pressure`, 0..1). `useInkDrawing`'s `addInkStroke`
 * feeds the accumulated points into the shared `strokeToInkElement`, which
 * authors a variable-width `inkPointPressures` channel when the pressure
 * genuinely varies, matching React's Draw tool.
 */
function toSlide(e: PointerEvent): InkPoint {
	const rect = rootRef.value?.getBoundingClientRect();
	const s = props.scale || 1;
	return {
		x: (e.clientX - (rect?.left ?? 0)) / s,
		y: (e.clientY - (rect?.top ?? 0)) / s,
		pressure: e.pressure,
	};
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
const liveWidth = computed(() => (isHighlighter.value ? props.width * 3 : props.width));
const liveOpacity = computed(() => (isHighlighter.value ? 0.4 : 1));
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
		<path
			v-if="livePath"
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
