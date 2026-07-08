<script setup lang="ts">
import type { PptxElement, SmartArtLayout } from 'pptx-viewer-core';
import { buildSmartArtPresetData, PRESETS } from 'pptx-viewer-shared';
import { computed } from 'vue';

import SmartArtRenderer from './SmartArtRenderer.vue';

/**
 * SmartArtPreviews - a live gallery preview for a SmartArt {@link SmartArtLayout}.
 *
 * Renders the real `SmartArtRenderer` output for the exact element the preset
 * inserts (same layout, default items, colour scheme, and style) scaled down to
 * gallery size, so the preview always matches the chart that appears on the
 * slide. Used by `InsertSmartArtDialog.vue` to populate the gallery tiles.
 */
const props = defineProps<{
	/** The layout to draw a thumbnail for. */
	layout: SmartArtLayout;
}>();

/** Element size the insert handler creates; previews render the same box. */
const PREVIEW_ELEMENT_WIDTH = 600;
const PREVIEW_ELEMENT_HEIGHT = 340;
/** Gallery tile width in px. */
const PREVIEW_TILE_WIDTH = 64;

const scale = PREVIEW_TILE_WIDTH / PREVIEW_ELEMENT_WIDTH;

const FALLBACK_ITEMS = ['1', '2', '3'];

const previewElement = computed<PptxElement>(() => {
	const preset = PRESETS.find((p) => p.layout === props.layout);
	return {
		id: `smartart-preview-${props.layout}`,
		type: 'smartArt',
		x: 0,
		y: 0,
		width: PREVIEW_ELEMENT_WIDTH,
		height: PREVIEW_ELEMENT_HEIGHT,
		smartArtData: buildSmartArtPresetData(props.layout, preset?.defaultItems ?? FALLBACK_ITEMS),
	} as unknown as PptxElement;
});
</script>

<template>
	<div
		class="pptx-vue-smartart-preview pointer-events-none overflow-hidden"
		:style="{
			width: `${PREVIEW_TILE_WIDTH}px`,
			height: `${Math.round(PREVIEW_ELEMENT_HEIGHT * scale)}px`,
		}"
		aria-hidden="true"
	>
		<div
			:style="{
				position: 'relative',
				width: `${PREVIEW_ELEMENT_WIDTH}px`,
				height: `${PREVIEW_ELEMENT_HEIGHT}px`,
				transform: `scale(${scale})`,
				transformOrigin: 'top left',
			}"
		>
			<SmartArtRenderer :element="previewElement" :z-index="0" />
		</div>
	</div>
</template>
