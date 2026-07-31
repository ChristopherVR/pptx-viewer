<script setup lang="ts">
/**
 * MotionPathOverlay: draws the selected element's motion path on the stage and
 * lets the user drag its end point. Vue port of React's
 * `canvas/MotionPathOverlay.tsx`, DOM contract included.
 *
 * WHY it is a stage-level sibling and not part of the element's own adorners: a
 * motion path routinely extends far outside the shape's bounding box, and the
 * element wrapper carries the shape's rotation / flip transform, which would
 * skew the path. Drawn here it shares the stage's unscaled slide-pixel space,
 * so the only zoom maths needed is converting the pointer delta back by
 * `scale`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	isEditableMotionPath,
	motionPathEndPixel,
	motionPathToSvgD,
	setMotionPathEnd,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';

const props = defineProps<{
	/** Element the path is anchored to; its centre is the path origin. */
	element: PptxElement;
	/** OOXML path data (slide fractions, relative to the element centre). */
	path: string;
	/** Stage size in slide pixels: the unit the path fractions scale by. */
	canvasSize: CanvasSize;
	/** Editor zoom, so a pointer delta converts back to slide pixels. */
	scale: number;
	/** Whether the end handle can be dragged. */
	canEdit: boolean;
}>();

const emit = defineEmits<{
	/** Commit an edited path (drag of the end handle). */
	changePath: [path: string];
}>();

const { t } = useI18n();

/** In-flight drag: the pointer that owns it plus its last client position. */
const drag = ref<{ pointerId: number; startX: number; startY: number } | null>(null);

const frame = computed(() => ({
	originX: props.element.x + props.element.width / 2,
	originY: props.element.y + props.element.height / 2,
	slideWidth: props.canvasSize.width,
	slideHeight: props.canvasSize.height,
}));
const pathD = computed(() => motionPathToSvgD(props.path, frame.value));
const end = computed(() => motionPathEndPixel(props.path, frame.value));
const editable = computed(() => props.canEdit && isEditableMotionPath(props.path));

function onPointerDown(event: PointerEvent): void {
	if (!editable.value) {
		return;
	}
	event.stopPropagation();
	event.preventDefault();
	// Capture keeps the drag alive when the pointer outruns the 14px handle.
	// Guarded because not every DOM implementation the tests run on has it.
	const target = event.currentTarget as SVGCircleElement & {
		setPointerCapture?: (pointerId: number) => void;
	};
	target.setPointerCapture?.(event.pointerId);
	drag.value = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
}

function onPointerMove(event: PointerEvent): void {
	const current = drag.value;
	if (!current || current.pointerId !== event.pointerId) {
		return;
	}
	event.stopPropagation();
	const zoom = props.scale || 1;
	const dxPx = (event.clientX - current.startX) / zoom;
	const dyPx = (event.clientY - current.startY) / zoom;
	const nextX = (end.value.x + dxPx - frame.value.originX) / frame.value.slideWidth;
	const nextY = (end.value.y + dyPx - frame.value.originY) / frame.value.slideHeight;
	const next = setMotionPathEnd(props.path, nextX, nextY);
	if (next !== props.path) {
		// Re-base the drag origin on every commit, so the next move measures from
		// the position just written rather than double-counting the whole delta.
		drag.value = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
		emit('changePath', next);
	}
}

function onPointerUp(event: PointerEvent): void {
	if (drag.value?.pointerId !== event.pointerId) {
		return;
	}
	const target = event.currentTarget as SVGCircleElement & {
		releasePointerCapture?: (pointerId: number) => void;
	};
	target.releasePointerCapture?.(event.pointerId);
	drag.value = null;
}
</script>

<template>
	<svg
		v-if="pathD"
		class="pointer-events-none absolute left-0 top-0 z-[45]"
		:width="canvasSize.width"
		:height="canvasSize.height"
		role="img"
		:aria-label="t('pptx.animation.motionPath.overlay')"
		data-pptx-motion-path-overlay="true"
	>
		<path
			:d="pathD"
			fill="none"
			stroke="#0ea5e9"
			stroke-width="2"
			stroke-dasharray="6 4"
			vector-effect="non-scaling-stroke"
		/>
		<circle :cx="frame.originX" :cy="frame.originY" r="5" fill="#0ea5e9" opacity="0.55" />
		<circle
			:cx="end.x"
			:cy="end.y"
			r="7"
			fill="#ffffff"
			stroke="#0ea5e9"
			stroke-width="2"
			:class="editable ? 'pointer-events-auto cursor-move' : ''"
			:aria-label="t('pptx.animation.motionPath.endHandle')"
			data-pptx-motion-path-handle="end"
			@pointerdown="onPointerDown"
			@pointermove="onPointerMove"
			@pointerup="onPointerUp"
			@pointercancel="onPointerUp"
		/>
	</svg>
</template>
