<script setup lang="ts">
/**
 * FreeformToolOverlay: the capture layer of the click-to-place Freeform: Shape
 * and Curve tools. Vue port of React's `canvas/FreeformToolOverlay.tsx`. The
 * gesture itself (corners, freehand runs, smooth spans, closing on the start
 * point, double-click / Enter / Escape) is the shared `FreeformToolSession`;
 * this only paints its preview and forwards events.
 */
import type { ShapePptxElement } from 'pptx-viewer-core';
import type { FreeformToolKind } from 'pptx-viewer-shared';
import { attachOverlayKeyboard, clientToSlidePoint, FreeformToolSession } from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';

const props = defineProps<{
	tool: FreeformToolKind;
	canvasSize: CanvasSize;
	scale: number;
	onCommit: (element: ShapePptxElement) => void;
	onCancel: () => void;
}>();

const { t } = useI18n();
const svgRef = useTemplateRef<SVGSVGElement>('svg');
const version = ref(0);
const session = shallowRef<FreeformToolSession | null>(null);
let detachKeyboard: (() => void) | null = null;

watch(
	() => props.tool,
	(tool) => {
		detachKeyboard?.();
		const next = new FreeformToolSession({
			tool,
			onCommit: (element) => props.onCommit(element),
			onCancel: () => props.onCancel(),
			onChange: () => {
				version.value++;
			},
		});
		session.value = next;
		detachKeyboard = attachOverlayKeyboard(next);
	},
	{ immediate: true },
);
onBeforeUnmount(() => detachKeyboard?.());

const view = computed(() => {
	void version.value;
	session.value?.setScale(props.scale);
	return session.value?.view() ?? null;
});

function point(event: PointerEvent | MouseEvent): { x: number; y: number } {
	return clientToSlidePoint(
		svgRef.value ?? (event.currentTarget as Element),
		event.clientX,
		event.clientY,
		props.canvasSize.width,
		props.canvasSize.height,
	);
}
function onPointerDown(event: PointerEvent): void {
	event.stopPropagation();
	event.preventDefault();
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
	session.value?.setScale(props.scale);
	session.value?.pointerDown({ ...point(event), button: event.button });
}
function onPointerMove(event: PointerEvent): void {
	session.value?.pointerMove(point(event));
}
function onPointerUp(event: PointerEvent): void {
	(event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
	session.value?.pointerUp();
}
function onDoubleClick(event: MouseEvent): void {
	event.stopPropagation();
	session.value?.doubleClick();
}
</script>

<template>
	<svg
		ref="svg"
		class="absolute left-0 top-0 z-[60]"
		:width="canvasSize.width"
		:height="canvasSize.height"
		role="application"
		:aria-label="t('pptx.freeformTool.overlay')"
		:data-pptx-freeform-tool-overlay="tool"
		style="cursor: crosshair; touch-action: none"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@dblclick="onDoubleClick"
		@contextmenu.prevent.stop
		@mousedown.stop
		@click.stop
	>
		<rect :width="canvasSize.width" :height="canvasSize.height" fill="transparent" />
		<path
			v-if="view?.previewD"
			:d="view.previewD"
			fill="none"
			stroke="#2f528f"
			:stroke-width="view.strokeWidth"
			pointer-events="none"
		/>
		<circle
			v-if="view?.start"
			:cx="view.start.x"
			:cy="view.start.y"
			:r="view.start.size / 2"
			:fill="view.start.armed ? '#2f528f' : '#ffffff'"
			stroke="#2f528f"
			:stroke-width="view.strokeWidth"
			pointer-events="none"
			:data-pptx-freeform-start="view.start.armed ? 'armed' : 'idle'"
		/>
	</svg>
</template>
