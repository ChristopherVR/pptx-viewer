<script setup lang="ts">
/**
 * SelectionOverlay - the editing interaction layer.
 *
 * Renders, for every selected element, a selection rectangle with 8 resize
 * handles (nw, n, ne, e, se, s, sw, w) and a rotate handle above the box. It
 * lives in the SAME coordinate space as the (already scaled) slide canvas, so
 * it must be mounted inside the scaled stage; the element x/y/width/height it
 * reads are unscaled element px, and the parent CSS `scale(zoom)` makes them
 * line up visually. The `zoom` prop is still needed to convert raw pointer
 * deltas (which are in screen px) back into element px.
 *
 * Interaction uses pointer capture on `document` so a gesture keeps tracking
 * even if the pointer leaves the handle.
 *
 * This file is deliberately thin: the placement maths live in
 * `selection-overlay-geometry` and the four-mode pointer state machine in the
 * `selection-gesture` composable, both of which are plain functions and are
 * tested as such. What is left here is the reactive wiring and the markup.
 *
 * Emitted events
 * --------------
 * - `transformStart` { id }                     : gesture begins.
 * - `transform`      { id, x, y, width, height, rotation } : live, every move.
 * - `transformEnd`   { id, x, y, width, height, rotation } : gesture ends.
 *
 * Consumers should apply `transform` live (for a responsive preview) and treat
 * `transformEnd` as the commit point for history/undo.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSelectionAffordances } from '../composables/element-lock-guards';
import { useSelectionGesture } from '../composables/selection-gesture';
import { getShapeAdjustmentHandleDescriptors } from '../composables/shape-adjustment';
import type { ShapeAdjustmentHandleDescriptor } from '../composables/shape-adjustment';
import {
	adjustHandleStyle as adjustHandleStyleFor,
	boxStyle,
	HANDLE_LIST,
	handleStyle,
	inverseZoom as inverseZoomFor,
	IS_COARSE_POINTER,
	rotateKnobStyle as rotateKnobStyleFor,
	rotateStemStyle as rotateStemStyleFor,
} from './selection-overlay-geometry';
import type { SelectedBox } from './selection-overlay-geometry';

// Re-exported for consumers that type the emitted payloads.
export type { AdjustPayload, TransformPayload } from './selection-overlay-geometry';

const props = defineProps<{
	elements: PptxElement[];
	selectedIds: string[];
	zoom: number;
}>();

const emit = defineEmits<{
	transformStart: [payload: { id: string }];
	transform: [payload: import('./selection-overlay-geometry').TransformPayload];
	transformEnd: [payload: import('./selection-overlay-geometry').TransformPayload];
	adjustStart: [payload: { id: string }];
	adjust: [payload: import('./selection-overlay-geometry').AdjustPayload];
	adjustEnd: [payload: import('./selection-overlay-geometry').AdjustPayload];
	/** A tap (no drag) on an already-selected element: enter inline edit. */
	requestEdit: [payload: { id: string }];
}>();

const { t } = useI18n();

/** The overlay root, so a rotation can map client coords into element space. */
const rootEl = ref<HTMLElement | null>(null);

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

// A shape must not advertise a gesture its `a:spLocks` will refuse: Vue painted
// all eight resize handles and the rotate knob unconditionally.
const { canResize, canRotate } = useSelectionAffordances(
	() => props.elements,
	() => props.selectedIds,
);

function elementForId(id: string) {
	return props.elements.find((e) => e.id === id);
}

/**
 * EVERY adjustment handle a selected element offers.
 *
 * PowerPoint shows one amber diamond per `a:avLst` guide and presets routinely
 * have several (`quadArrow` three, `callout3` four); this used to return one,
 * so the rest were unreachable.
 */
function adjustDescriptorsFor(id: string): ShapeAdjustmentHandleDescriptor[] {
	const el = elementForId(id);
	return el ? getShapeAdjustmentHandleDescriptors(el) : [];
}

const { beginGesture, beginAdjust } = useSelectionGesture({
	zoom: () => props.zoom,
	boxForId,
	elementForId,
	rootEl,
	onTransformStart: (payload) => emit('transformStart', payload),
	onTransform: (payload) => emit('transform', payload),
	onTransformEnd: (payload) => emit('transformEnd', payload),
	onAdjustStart: (payload) => emit('adjustStart', payload),
	onAdjust: (payload) => emit('adjust', payload),
	onAdjustEnd: (payload) => emit('adjustEnd', payload),
	onRequestEdit: (payload) => emit('requestEdit', payload),
});

const handleList = HANDLE_LIST;
const inverseZoom = computed<number>(() => inverseZoomFor(props.zoom));

const rotateStemStyle = (box: SelectedBox): Record<string, string> =>
	rotateStemStyleFor(box, props.zoom);
const rotateKnobStyle = (box: SelectedBox): Record<string, string> =>
	rotateKnobStyleFor(box, props.zoom);
const adjustHandleStyle = (descriptor: ShapeAdjustmentHandleDescriptor): Record<string, string> =>
	adjustHandleStyleFor(descriptor);
</script>

<template>
	<div
		ref="rootEl"
		class="pptx-vue-selection-overlay"
		:class="{ 'is-coarse-pointer': IS_COARSE_POINTER }"
		data-testid="selection-overlay"
		:style="{ '--pptx-vue-hs': String(inverseZoom) }"
	>
		<div
			v-for="box in selectedBoxes"
			:key="box.id"
			class="pptx-vue-selection-box"
			:data-selection-for="box.id"
			:style="boxStyle(box)"
		>
			<!-- Body: drag-to-move hit area covering the box interior -->
			<div class="pptx-vue-selection-body" @pointerdown="(e) => beginGesture('move', box.id, e)" />

			<!-- Rotate stem + knob. Hidden by `a:spLocks/@noRotation`. -->
			<template v-if="canRotate(box.id)">
				<div class="pptx-vue-rotate-stem" :style="rotateStemStyle(box)" />
				<button
					type="button"
					class="pptx-vue-rotate-knob"
					data-pptx-compact
					:style="rotateKnobStyle(box)"
					:aria-label="t('pptx.selectionOverlay.rotate')"
					@pointerdown="(e) => beginGesture('rotate', box.id, e)"
				/>
			</template>

			<!-- Resize handles. Hidden by `a:spLocks/@noResize`. -->
			<template v-if="canResize(box.id)">
				<button
					v-for="meta in handleList"
					:key="meta.id"
					type="button"
					class="pptx-vue-resize-handle"
					:class="`pptx-vue-resize-${meta.id}`"
					data-pptx-compact
					:data-handle="meta.id"
					:style="handleStyle(meta, box)"
					:aria-label="t('pptx.selectionOverlay.resize', { handle: meta.id })"
					@pointerdown="(e) => beginGesture('resize', box.id, e, meta.id)"
				/>
			</template>

			<!-- Shape adjustment handles (amber diamonds): one per `a:avLst` guide -->
			<button
				v-for="descriptor in adjustDescriptorsFor(box.id)"
				:key="`adjust-${descriptor.key}`"
				type="button"
				class="pptx-vue-adjust-handle"
				data-pptx-compact
				:data-pptx-adjust-key="descriptor.key"
				:style="adjustHandleStyle(descriptor)"
				:aria-label="t('pptx.selectionOverlay.adjust')"
				@pointerdown="(e) => beginAdjust(box.id, descriptor, e)"
			/>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-selection-overlay {
	position: absolute;
	inset: 0;
	/* The overlay container itself never intercepts pointer events; only the
	   handles and the per-box drag body (which are re-enabled below) do.
	   50 left a slide with 50+ elements able to paint its topmost elements
	   above this host, hiding the selected element's own handles behind its
	   own fill; bumped to match the other four bindings' headroom. */
	pointer-events: none;
	z-index: 58;
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
	/* The body never intercepts pointer events; move + inline-edit entry are
	   driven from the element itself (host pointer delegation), so taps reach the
	   underlying element (required for e2e actionability + double-tap-to-edit).
	   Only the resize/rotate/adjust handles capture. */
	pointer-events: none;
	cursor: move;
}

.pptx-vue-resize-handle {
	position: absolute;
	/* Sized against the inverse stage zoom (--pptx-vue-hs) so the on-screen
	   hit area stays 10px regardless of zoom; see `inverseZoom` above. */
	width: calc(10px * var(--pptx-vue-hs, 1));
	height: calc(10px * var(--pptx-vue-hs, 1));
	margin: calc(-5px * var(--pptx-vue-hs, 1)) 0 0 calc(-5px * var(--pptx-vue-hs, 1));
	padding: 0;
	border: 1px solid #ffffff;
	border-radius: 9999px;
	background: var(--pptx-vue-selection-color, #3b82f6);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	pointer-events: auto;
	/* Resize handles must own their touch gesture (no scroll/zoom stealing). */
	touch-action: none;
}

/*
 * On coarse (touch) pointers a 10px handle is far too small to grab reliably.
 * Grow the resize/rotate hit targets to a finger-friendly size; the visual
 * footprint stays modest but the tappable area is large.
 */
.pptx-vue-selection-overlay.is-coarse-pointer .pptx-vue-resize-handle {
	width: calc(22px * var(--pptx-vue-hs, 1));
	height: calc(22px * var(--pptx-vue-hs, 1));
	margin: calc(-11px * var(--pptx-vue-hs, 1)) 0 0 calc(-11px * var(--pptx-vue-hs, 1));
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
	width: calc(12px * var(--pptx-vue-hs, 1));
	height: calc(12px * var(--pptx-vue-hs, 1));
	margin: calc(-6px * var(--pptx-vue-hs, 1)) 0 0 calc(-6px * var(--pptx-vue-hs, 1));
	padding: 0;
	border: 1px solid #ffffff;
	border-radius: 9999px;
	background: var(--pptx-vue-selection-color, #3b82f6);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	cursor: grab;
	pointer-events: auto;
	touch-action: none;
}

.pptx-vue-selection-overlay.is-coarse-pointer .pptx-vue-rotate-knob {
	width: calc(24px * var(--pptx-vue-hs, 1));
	height: calc(24px * var(--pptx-vue-hs, 1));
	margin: calc(-12px * var(--pptx-vue-hs, 1)) 0 0 calc(-12px * var(--pptx-vue-hs, 1));
}

/* Shape-adjustment handle: amber diamond (rotate 45°), mirrors React. */
.pptx-vue-adjust-handle {
	position: absolute;
	width: calc(10px * var(--pptx-vue-hs, 1));
	height: calc(10px * var(--pptx-vue-hs, 1));
	margin: calc(-5px * var(--pptx-vue-hs, 1)) 0 0 calc(-5px * var(--pptx-vue-hs, 1));
	padding: 0;
	border: 1px solid #ffffff;
	background: #fcd34d;
	transform: rotate(45deg);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	pointer-events: auto;
	touch-action: none;
}

.pptx-vue-selection-overlay.is-coarse-pointer .pptx-vue-adjust-handle {
	width: calc(22px * var(--pptx-vue-hs, 1));
	height: calc(22px * var(--pptx-vue-hs, 1));
	margin: calc(-11px * var(--pptx-vue-hs, 1)) 0 0 calc(-11px * var(--pptx-vue-hs, 1));
}
</style>
