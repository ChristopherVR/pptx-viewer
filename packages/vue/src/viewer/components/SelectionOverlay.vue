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
import { getResizeHandleHitAreaStyle } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSelectionAffordances } from '../composables/element-lock-guards';
import { useSelectionGesture } from '../composables/selection-gesture';
import { getShapeAdjustmentHandleDescriptors } from '../composables/shape-adjustment';
import type { ShapeAdjustmentHandleDescriptor } from '../composables/shape-adjustment';
import { vRotateHandlePlacement } from './rotate-handle-placement';
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
	/** Keep handles above the active editor without changing connector layering. */
	inlineEditing?: boolean;
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
		:class="{ 'is-coarse-pointer': IS_COARSE_POINTER, 'is-inline-editing': inlineEditing }"
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
				<div data-pptx-rotate-stem class="pptx-vue-rotate-stem" :style="rotateStemStyle(box)" />
				<button
					v-rotate-handle-placement
					data-pptx-handle-kind="rotate"
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
					data-pptx-handle-kind="resize"
					:style="handleStyle(meta, box)"
					:aria-label="t('pptx.selectionOverlay.resize', { handle: meta.id })"
					@pointerdown="(e) => beginGesture('resize', box.id, e, meta.id)"
				>
					<span data-pptx-handle-hit :style="getResizeHandleHitAreaStyle(meta.id)" />
				</button>
			</template>

			<!-- Shape adjustment handles (amber diamonds): one per `a:avLst` guide -->
			<button
				v-for="descriptor in adjustDescriptorsFor(box.id)"
				:key="`adjust-${descriptor.key}`"
				type="button"
				class="pptx-vue-adjust-handle"
				data-pptx-compact
				:data-pptx-adjust-key="descriptor.key"
				data-pptx-handle-kind="adjust"
				:style="adjustHandleStyle(descriptor)"
				:aria-label="t('pptx.selectionOverlay.adjust')"
				@pointerdown="(e) => beginAdjust(box.id, descriptor, e)"
			/>
		</div>
	</div>
</template>

<style scoped src="./selection-overlay.css" />
