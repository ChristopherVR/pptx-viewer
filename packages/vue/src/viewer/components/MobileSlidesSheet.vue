<script setup lang="ts">
/**
 * MobileSlidesSheet - Vue port of React's
 * `components/mobile/MobileSlidesSheet.tsx`.
 *
 * Bottom-sheet host for the slide rail on a phone. Reuses the existing
 * `SlidesPaneSidebar` (number-left thumbnails, drag reorder, context menu, Add
 * Slide) inside the shared swipe-dismiss `MobileSheet`, so the slide panel that
 * is a left rail on desktop becomes a drag-up sheet on mobile. Selecting a
 * slide closes the sheet (mirrors React's `onSelectSlide`).
 *
 * The host owns the open state and forwards the same slide-operation handlers
 * it already wires for the desktop rail.
 */
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../types';
import MobileSheet from './MobileSheet.vue';
import SlidesPaneSidebar from './SlidesPaneSidebar.vue';

const props = defineProps<{
	open: boolean;
	slides: PptxSlide[];
	activeIndex: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	close: [];
	select: [index: number];
	reorder: [payload: { from: number; to: number }];
	'add-slide': [];
	duplicate: [index: number];
	delete: [index: number];
	'toggle-hidden': [index: number];
}>();

/** Selecting a slide navigates and dismisses the sheet (React parity). */
function onSelect(index: number): void {
	emit('select', index);
	emit('close');
}
</script>

<template>
	<MobileSheet :open="props.open" title="Slides" @close="emit('close')">
		<SlidesPaneSidebar
			:slides="props.slides"
			:active-index="props.activeIndex"
			:canvas-size="props.canvasSize"
			:media-data-urls="props.mediaDataUrls"
			:can-edit="props.canEdit"
			@select="onSelect"
			@reorder="(p) => emit('reorder', p)"
			@add-slide="emit('add-slide')"
			@duplicate="(i) => emit('duplicate', i)"
			@delete="(i) => emit('delete', i)"
			@toggle-hidden="(i) => emit('toggle-hidden', i)"
		/>
	</MobileSheet>
</template>
