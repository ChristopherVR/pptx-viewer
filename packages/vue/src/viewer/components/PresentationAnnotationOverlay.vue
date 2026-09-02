<script setup lang="ts">
import { annotationOverlayZIndex, buildStrokePathD, cursorForTool } from 'pptx-viewer-shared';
import type { PresentationBlackout } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';

import type {
	AnnotationStroke,
	LaserPosition,
	PresentationTool,
} from '../composables/usePresentationAnnotations';
import type { CanvasSize } from '../types';

/**
 * PresentationAnnotationOverlay - transparent SVG overlay drawn on top of the
 * slide during presentation mode. Captures pointer events for the
 * pen/highlighter/eraser tools and renders the laser-pointer dot. Vue port of
 * the React `PresentationAnnotationOverlay`.
 *
 * Coordinate conversion divides client coordinates by `editorScale` so emitted
 * points are in the slide's unscaled coordinate space (matching
 * `usePresentationAnnotations`). Renders `null` (nothing) when the tool is
 * `'none'`.
 */
const props = withDefaults(
	defineProps<{
		canvasSize: CanvasSize;
		editorScale: number;
		presentationTool: PresentationTool;
		annotationStrokes: AnnotationStroke[];
		currentStroke: AnnotationStroke | null;
		laserPosition: LaserPosition | null;
		/**
		 * Presenter-snapshot blackout state. During a blackout the overlay is
		 * raised ABOVE the blackout sheet (shared `annotationOverlayZIndex`) so
		 * "blackboard" ink stays visible on the blank screen.
		 */
		blackout?: PresentationBlackout;
	}>(),
	{ blackout: 'none' },
);

const emit = defineEmits<{
	(e: 'pointer-down' | 'pointer-move' | 'laser-move' | 'erase', x: number, y: number): void;
	(e: 'pointer-up' | 'laser-leave'): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
let isErasing = false;

function toSlideCoords(clientX: number, clientY: number): { x: number; y: number } | null {
	const svg = svgRef.value;
	if (!svg) {
		return null;
	}
	const rect = svg.getBoundingClientRect();
	return {
		x: (clientX - rect.left) / props.editorScale,
		y: (clientY - rect.top) / props.editorScale,
	};
}

function onPointerDown(event: PointerEvent): void {
	if (props.presentationTool === 'none') {
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	const coords = toSlideCoords(event.clientX, event.clientY);
	if (!coords) {
		return;
	}
	if (props.presentationTool === 'eraser') {
		isErasing = true;
		emit('erase', coords.x, coords.y);
		return;
	}
	if (props.presentationTool === 'pen' || props.presentationTool === 'highlighter') {
		emit('pointer-down', coords.x, coords.y);
	}
}

function onPointerMove(event: PointerEvent): void {
	if (props.presentationTool === 'none') {
		return;
	}
	const coords = toSlideCoords(event.clientX, event.clientY);
	if (!coords) {
		return;
	}
	if (props.presentationTool === 'laser') {
		emit('laser-move', coords.x, coords.y);
		return;
	}
	if (props.presentationTool === 'eraser' && isErasing) {
		emit('erase', coords.x, coords.y);
		return;
	}
	if (props.presentationTool === 'pen' || props.presentationTool === 'highlighter') {
		emit('pointer-move', coords.x, coords.y);
	}
}

function onPointerUp(event: PointerEvent): void {
	if (props.presentationTool === 'none') {
		return;
	}
	event.preventDefault();
	if (props.presentationTool === 'eraser') {
		isErasing = false;
		return;
	}
	emit('pointer-up');
}

function onPointerLeave(): void {
	if (props.presentationTool === 'laser') {
		emit('laser-leave');
	}
	if (props.presentationTool === 'eraser') {
		isErasing = false;
	}
	emit('pointer-up');
}

const cursor = computed<string>(() => cursorForTool(props.presentationTool));

const allStrokes = computed<AnnotationStroke[]>(() =>
	props.currentStroke ? [...props.annotationStrokes, props.currentStroke] : props.annotationStrokes,
);

/**
 * Cursor + stacking level. The z-index is bound inline (scoped CSS is static):
 * 60 during a normal show, raised above the z-75 blackout sheet while the
 * screen is blanked, per the shared blackboard layering rules.
 */
const overlayStyle = computed<CSSProperties>(() => ({
	cursor: cursor.value,
	zIndex: annotationOverlayZIndex(props.blackout),
}));

const svgStyle = computed<CSSProperties>(() => ({
	position: 'absolute',
	width: `${props.canvasSize.width}px`,
	height: `${props.canvasSize.height}px`,
	transformOrigin: 'top left',
	transform: `scale(${props.editorScale})`,
}));

const laserStyle = computed<CSSProperties | undefined>(() => {
	if (props.presentationTool !== 'laser' || !props.laserPosition) {
		return undefined;
	}
	return {
		position: 'absolute',
		width: '24px',
		height: '24px',
		left: `${props.laserPosition.x * props.editorScale - 12}px`,
		top: `${props.laserPosition.y * props.editorScale - 12}px`,
		backgroundColor: 'rgba(255, 0, 0, 0.85)',
		boxShadow: '0 0 12px 6px rgba(255, 0, 0, 0.5), 0 0 24px 12px rgba(255, 0, 0, 0.25)',
		filter: 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.7))',
		borderRadius: '50%',
		pointerEvents: 'none',
		zIndex: 70,
	};
});
</script>

<template>
	<div
		v-if="presentationTool !== 'none'"
		class="pptx-vue-annotation-overlay"
		data-pptx-annotation-overlay
		:style="overlayStyle"
	>
		<svg
			ref="svgRef"
			:style="svgStyle"
			:viewBox="`0 0 ${canvasSize.width} ${canvasSize.height}`"
			@pointerdown="onPointerDown"
			@pointermove="onPointerMove"
			@pointerup="onPointerUp"
			@pointerleave="onPointerLeave"
		>
			<path
				v-for="stroke in allStrokes"
				:key="stroke.id"
				:d="buildStrokePathD(stroke.points)"
				fill="none"
				:stroke="stroke.color"
				:stroke-width="stroke.width"
				:opacity="stroke.opacity"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		<div v-if="laserStyle" class="pptx-vue-annotation-laser" :style="laserStyle" />
	</div>
</template>

<style scoped>
/* The z-index is bound inline (`overlayStyle`): it comes from the shared
   `annotationOverlayZIndex(blackout)` rule and a scoped stylesheet cannot see
   the blackout state. */
.pptx-vue-annotation-overlay {
	position: absolute;
	inset: 0;
	pointer-events: auto;
}
</style>
