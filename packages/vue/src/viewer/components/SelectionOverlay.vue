<script setup lang="ts">
/**
 * SelectionOverlay — the editing interaction layer.
 *
 * Renders, for every selected element, a selection rectangle with 8 resize
 * handles (nw, n, ne, e, se, s, sw, w) and a rotate handle above the box. It
 * lives in the SAME coordinate space as the (already scaled) slide canvas, so
 * it must be mounted inside the scaled stage — the element x/y/width/height it
 * reads are unscaled element px, and the parent CSS `scale(zoom)` makes them
 * line up visually. The `zoom` prop is still needed to convert raw pointer
 * deltas (which are in screen px) back into element px.
 *
 * Interaction uses pointer capture on `document` so a gesture keeps tracking
 * even if the pointer leaves the handle.
 *
 * Emitted events
 * --------------
 * - `transformStart` { id }                     — gesture begins.
 * - `transform`      { id, x, y, width, height, rotation } — live, every move.
 * - `transformEnd`   { id, x, y, width, height, rotation } — gesture ends.
 *
 * Consumers should apply `transform` live (for a responsive preview) and treat
 * `transformEnd` as the commit point for history/undo.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	applyDragDelta,
	applyResize,
	boxCenter,
	computeRotation,
	RESIZE_HANDLES,
	snapAngle,
} from 'pptx-viewer-shared';
import type { InteractionBox, ResizeHandleId } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

const props = defineProps<{
	elements: PptxElement[];
	selectedIds: string[];
	zoom: number;
}>();

export interface TransformPayload {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

const emit = defineEmits<{
	transformStart: [payload: { id: string }];
	transform: [payload: TransformPayload];
	transformEnd: [payload: TransformPayload];
}>();

// ---------------------------------------------------------------------------
// Geometry of currently-selected elements
// ---------------------------------------------------------------------------

interface SelectedBox extends InteractionBox {
	id: string;
}

const selectedBoxes = computed<SelectedBox[]>(() => {
	const ids = new Set(props.selectedIds);
	return props.elements
		.filter((el) => ids.has(el.id))
		.map((el) => ({
			id: el.id,
			x: el.x,
			y: el.y,
			width: el.width,
			height: el.height,
			rotation: el.rotation ?? 0,
		}));
});

/** The element box used as the live source of truth during a gesture. */
function boxForId(id: string): SelectedBox | undefined {
	return selectedBoxes.value.find((b) => b.id === id);
}

// Length of the rotate-handle stem, in element px (visually constant via the
// parent scale; matches typical editor affordances).
const ROTATE_STEM = 24;

// ---------------------------------------------------------------------------
// Active gesture state
// ---------------------------------------------------------------------------

type GestureKind = 'move' | 'resize' | 'rotate';

interface Gesture {
	kind: GestureKind;
	id: string;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startBox: InteractionBox;
	handle?: ResizeHandleId;
	/** Whether the gesture has moved past the dead-zone threshold. */
	moved: boolean;
	/** Shift held — used for rotation snap. */
	shift: boolean;
	last: TransformPayload;
}

const gesture = ref<Gesture | null>(null);

function payloadFromBox(id: string, box: InteractionBox): TransformPayload {
	return {
		id,
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		rotation: box.rotation ?? 0,
	};
}

// ---------------------------------------------------------------------------
// Pointer-space -> element-space mapping for rotation
// ---------------------------------------------------------------------------

/** The overlay root, so we can map client coords into element space. */
const rootEl = ref<HTMLElement | null>(null);

/**
 * Convert a client (screen) point into element-space coordinates, accounting
 * for the overlay's on-screen position and the canvas `zoom`.
 */
function clientToElement(clientX: number, clientY: number): { x: number; y: number } {
	const scale = props.zoom || 1;
	const rect = rootEl.value?.getBoundingClientRect();
	const left = rect?.left ?? 0;
	const top = rect?.top ?? 0;
	return {
		x: (clientX - left) / scale,
		y: (clientY - top) / scale,
	};
}

// ---------------------------------------------------------------------------
// Gesture lifecycle
// ---------------------------------------------------------------------------

function beginGesture(
	kind: GestureKind,
	id: string,
	event: PointerEvent,
	handle?: ResizeHandleId,
): void {
	const box = boxForId(id);
	if (!box) {
		return;
	}
	event.preventDefault();
	event.stopPropagation();

	const startBox: InteractionBox = {
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		rotation: box.rotation ?? 0,
	};

	gesture.value = {
		kind,
		id,
		pointerId: event.pointerId,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startBox,
		handle,
		moved: false,
		shift: event.shiftKey,
		last: payloadFromBox(id, startBox),
	};

	const target = event.currentTarget as HTMLElement | null;
	target?.setPointerCapture?.(event.pointerId);

	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);

	emit('transformStart', { id });
}

function onPointerMove(event: PointerEvent): void {
	const g = gesture.value;
	if (!g || event.pointerId !== g.pointerId) {
		return;
	}

	const dxScreen = event.clientX - g.startClientX;
	const dyScreen = event.clientY - g.startClientY;
	if (!g.moved && (Math.abs(dxScreen) > 2 || Math.abs(dyScreen) > 2)) {
		g.moved = true;
	}
	if (!g.moved) {
		return;
	}

	let next: TransformPayload;
	if (g.kind === 'move') {
		next = payloadFromBox(g.id, applyDragDelta(g.startBox, dxScreen, dyScreen, props.zoom));
	} else if (g.kind === 'resize' && g.handle) {
		next = payloadFromBox(g.id, applyResize(g.startBox, g.handle, dxScreen, dyScreen, props.zoom));
	} else {
		// rotate
		const center = boxCenter(g.startBox);
		const pointer = clientToElement(event.clientX, event.clientY);
		let angle = computeRotation(center, pointer);
		if (event.shiftKey) {
			angle = snapAngle(angle);
		}
		next = { ...payloadFromBox(g.id, g.startBox), rotation: angle };
	}

	g.last = next;
	emit('transform', next);
}

function onPointerUp(event: PointerEvent): void {
	const g = gesture.value;
	if (!g || event.pointerId !== g.pointerId) {
		return;
	}
	detachGlobalListeners();
	// Emit a final commit. If the gesture never moved, `last` is the start box,
	// which is a harmless no-op commit (consumers can short-circuit identical).
	emit('transformEnd', g.last);
	gesture.value = null;
}

function detachGlobalListeners(): void {
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	window.removeEventListener('pointercancel', onPointerUp);
}

// ---------------------------------------------------------------------------
// Handle metadata (placement only — visual offset handled by CSS classes)
// ---------------------------------------------------------------------------

interface HandleMeta {
	id: ResizeHandleId;
	cursor: string;
	/** Fractional position within the box: 0 = left/top, 1 = right/bottom. */
	fx: number;
	fy: number;
}

const HANDLE_META: Record<ResizeHandleId, { cursor: string; fx: number; fy: number }> = {
	nw: { cursor: 'nwse-resize', fx: 0, fy: 0 },
	n: { cursor: 'ns-resize', fx: 0.5, fy: 0 },
	ne: { cursor: 'nesw-resize', fx: 1, fy: 0 },
	e: { cursor: 'ew-resize', fx: 1, fy: 0.5 },
	se: { cursor: 'nwse-resize', fx: 1, fy: 1 },
	s: { cursor: 'ns-resize', fx: 0.5, fy: 1 },
	sw: { cursor: 'nesw-resize', fx: 0, fy: 1 },
	w: { cursor: 'ew-resize', fx: 0, fy: 0.5 },
};

const handleList = computed<HandleMeta[]>(() =>
	RESIZE_HANDLES.map((id) => ({ id, ...HANDLE_META[id] })),
);

function boxStyle(box: SelectedBox): Record<string, string> {
	const rotation = box.rotation ?? 0;
	return {
		left: `${box.x}px`,
		top: `${box.y}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		transform: rotation ? `rotate(${rotation}deg)` : 'none',
	};
}

function handleStyle(meta: HandleMeta, box: SelectedBox): Record<string, string> {
	return {
		left: `${meta.fx * box.width}px`,
		top: `${meta.fy * box.height}px`,
		cursor: meta.cursor,
	};
}

function rotateStemStyle(box: SelectedBox): Record<string, string> {
	return {
		left: `${box.width / 2}px`,
		top: `${-ROTATE_STEM}px`,
		height: `${ROTATE_STEM}px`,
	};
}

function rotateKnobStyle(box: SelectedBox): Record<string, string> {
	return {
		left: `${box.width / 2}px`,
		top: `${-ROTATE_STEM}px`,
	};
}
</script>

<template>
	<div ref="rootEl" class="pptx-vue-selection-overlay" data-testid="selection-overlay">
		<div
			v-for="box in selectedBoxes"
			:key="box.id"
			class="pptx-vue-selection-box"
			:data-selection-for="box.id"
			:style="boxStyle(box)"
		>
			<!-- Body: drag-to-move hit area covering the box interior -->
			<div class="pptx-vue-selection-body" @pointerdown="(e) => beginGesture('move', box.id, e)" />

			<!-- Rotate handle stem + knob -->
			<div class="pptx-vue-rotate-stem" :style="rotateStemStyle(box)" />
			<button
				type="button"
				class="pptx-vue-rotate-knob"
				:style="rotateKnobStyle(box)"
				aria-label="Rotate element"
				@pointerdown="(e) => beginGesture('rotate', box.id, e)"
			/>

			<!-- Resize handles -->
			<button
				v-for="meta in handleList"
				:key="meta.id"
				type="button"
				class="pptx-vue-resize-handle"
				:class="`pptx-vue-resize-${meta.id}`"
				:data-handle="meta.id"
				:style="handleStyle(meta, box)"
				:aria-label="`Resize ${meta.id}`"
				@pointerdown="(e) => beginGesture('resize', box.id, e, meta.id)"
			/>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-selection-overlay {
	position: absolute;
	inset: 0;
	/* The overlay container itself never intercepts pointer events; only the
	   handles and the per-box drag body (which are re-enabled below) do. */
	pointer-events: none;
	z-index: 50;
}

.pptx-vue-selection-box {
	position: absolute;
	box-sizing: border-box;
	border: 1px solid var(--pptx-vue-selection-color, #3b82f6);
	transform-origin: center center;
	pointer-events: none;
}

.pptx-vue-selection-body {
	position: absolute;
	inset: 0;
	pointer-events: auto;
	cursor: move;
}

.pptx-vue-resize-handle {
	position: absolute;
	width: 10px;
	height: 10px;
	margin: -5px 0 0 -5px;
	padding: 0;
	border: 1px solid #ffffff;
	border-radius: 9999px;
	background: var(--pptx-vue-selection-color, #3b82f6);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	pointer-events: auto;
}

.pptx-vue-rotate-stem {
	position: absolute;
	width: 1px;
	margin-left: -0.5px;
	background: var(--pptx-vue-selection-color, #3b82f6);
	pointer-events: none;
}

.pptx-vue-rotate-knob {
	position: absolute;
	width: 12px;
	height: 12px;
	margin: -6px 0 0 -6px;
	padding: 0;
	border: 1px solid #ffffff;
	border-radius: 9999px;
	background: var(--pptx-vue-selection-color, #3b82f6);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	cursor: grab;
	pointer-events: auto;
}
</style>
