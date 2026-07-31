<script setup lang="ts">
/**
 * RulerStrips - horizontal + vertical rulers (View > Rulers), drawn along the
 * top and left edges of the slide. Vue port of React's `Ruler` / `RulerStrips`,
 * kept in step with the Svelte `RulerStrips.svelte`.
 *
 * Tick geometry comes from the shared `generateTicks` (scaled px from the slide
 * origin), so every binding agrees on unit, subdivision density and label
 * thinning. The strips are positioned just OUTSIDE the slide wrapper (negative
 * offsets) rather than inside the scaled stage, because a ruler inside the
 * stage would have its strokes and labels scaled by the zoom transform instead
 * of tracking it.
 *
 * The strips are interactive: dragging off one drops a guide, resolved by the
 * shared `rulerDragToGuidePosition` rules. They were previously
 * `pointer-events: none`, which silently disabled the gesture React, Angular
 * and Svelte all offer.
 */
import { computed, ref } from 'vue';

import {
	generateTicks,
	RULER_FONT_SIZE,
	RULER_THICKNESS,
	rulerDragToGuidePosition,
} from '../composables/ruler-utils';
import type { RulerUnit } from '../composables/ruler-utils';
import type { CanvasSize } from '../types';

/** Bounding box (unscaled slide px) highlighted on the strips. */
interface SelectedBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

const props = withDefaults(
	defineProps<{
		canvasSize: CanvasSize;
		scale: number;
		unit?: RulerUnit;
		/** Selected element extent, highlighted on both strips as PowerPoint does. */
		selectedBounds?: SelectedBounds | null;
		/** Enable the drag-out-a-guide gesture (editing only). */
		draggable?: boolean;
	}>(),
	{ unit: 'inches', selectedBounds: null, draggable: false },
);

const emit = defineEmits<{ createGuide: [axis: 'h' | 'v', position: number] }>();

const stripW = computed(() => props.canvasSize.width * props.scale);
const stripH = computed(() => props.canvasSize.height * props.scale);
const hTicks = computed(() => generateTicks(props.canvasSize.width, props.scale, props.unit));
const vTicks = computed(() => generateTicks(props.canvasSize.height, props.scale, props.unit));
const T = RULER_THICKNESS;
const FS = RULER_FONT_SIZE;

const hHighlight = computed(() =>
	props.selectedBounds
		? {
				start: props.selectedBounds.x * props.scale,
				span: Math.max(props.selectedBounds.width * props.scale, 1),
			}
		: null,
);
const vHighlight = computed(() =>
	props.selectedBounds
		? {
				start: props.selectedBounds.y * props.scale,
				span: Math.max(props.selectedBounds.height * props.scale, 1),
			}
		: null,
);

// A guide is created on pointer-UP, not pointer-down, so a stray click on a
// strip cannot drop a guide the user never dragged out (React/Svelte agree).
const dragAxis = ref<'h' | 'v' | null>(null);

function startDrag(axis: 'h' | 'v', event: PointerEvent): void {
	if (!props.draggable) {
		return;
	}
	// The canvas' own pointerdown clears the selection and starts a marquee, so
	// a ruler drag must not bubble into it.
	event.stopPropagation();
	event.preventDefault();
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
	dragAxis.value = axis;
}

function endDrag(event: PointerEvent): void {
	const axis = dragAxis.value;
	dragAxis.value = null;
	const strip = event.currentTarget as Element | null;
	if (!axis || !props.draggable || !strip) {
		return;
	}
	try {
		strip.releasePointerCapture?.(event.pointerId);
	} catch {
		// Capture may already have been released by the browser.
	}
	const rect = strip.getBoundingClientRect();
	const offset = axis === 'h' ? event.clientY - rect.top : event.clientX - rect.left;
	const position = rulerDragToGuidePosition(
		offset,
		props.scale,
		axis === 'h' ? props.canvasSize.height : props.canvasSize.width,
	);
	if (position !== null) {
		emit('createGuide', axis, position);
	}
}
</script>

<template>
	<!-- Corner -->
	<div
		class="absolute bg-secondary border-r border-b border-border"
		:style="{ top: `-${T}px`, left: `-${T}px`, width: `${T}px`, height: `${T}px` }"
		aria-hidden="true"
	/>
	<!-- Horizontal ruler: drag down onto the slide for a horizontal guide -->
	<svg
		class="absolute bg-secondary border-b border-border text-muted-foreground select-none touch-none"
		:class="draggable ? 'cursor-row-resize' : ''"
		:style="{ top: `-${T}px`, left: '0px' }"
		:width="stripW"
		:height="T"
		data-pptx-ruler="h"
		role="presentation"
		@pointerdown="startDrag('h', $event)"
		@pointerup="endDrag"
	>
		<rect
			v-if="hHighlight"
			:x="hHighlight.start"
			:y="0"
			:width="hHighlight.span"
			:height="T"
			class="fill-primary/20"
		/>
		<template v-for="(t, i) in hTicks" :key="i">
			<line
				:x1="t.position"
				:x2="t.position"
				:y1="t.isMajor ? T - T * 0.6 : T - T * 0.3"
				:y2="T"
				stroke="currentColor"
				:stroke-width="t.isMajor ? 1 : 0.5"
			/>
			<text v-if="t.label" :x="t.position + 2" :y="FS + 1" :font-size="FS" fill="currentColor">
				{{ t.label }}
			</text>
		</template>
	</svg>
	<!-- Vertical ruler: drag right onto the slide for a vertical guide -->
	<svg
		class="absolute bg-secondary border-r border-border text-muted-foreground select-none touch-none"
		:class="draggable ? 'cursor-col-resize' : ''"
		:style="{ top: '0px', left: `-${T}px` }"
		:width="T"
		:height="stripH"
		data-pptx-ruler="v"
		role="presentation"
		@pointerdown="startDrag('v', $event)"
		@pointerup="endDrag"
	>
		<rect
			v-if="vHighlight"
			:x="0"
			:y="vHighlight.start"
			:width="T"
			:height="vHighlight.span"
			class="fill-primary/20"
		/>
		<template v-for="(t, i) in vTicks" :key="i">
			<line
				:y1="t.position"
				:y2="t.position"
				:x1="t.isMajor ? T - T * 0.6 : T - T * 0.3"
				:x2="T"
				stroke="currentColor"
				:stroke-width="t.isMajor ? 1 : 0.5"
			/>
			<text v-if="t.label" :x="2" :y="t.position + FS + 2" :font-size="FS" fill="currentColor">
				{{ t.label }}
			</text>
		</template>
	</svg>
</template>
