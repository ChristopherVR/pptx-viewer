<script setup lang="ts">
import type { PptxElement, SmartArtLayout } from 'pptx-viewer-core';
import {
	buildSmartArtPreviewElement,
	SMARTART_PREVIEW_ELEMENT_HEIGHT,
	SMARTART_PREVIEW_ELEMENT_WIDTH,
} from 'pptx-viewer-shared';
import { computed } from 'vue';

import SmartArtRenderer from './SmartArtRenderer.vue';

/**
 * SmartArtPreviews - a live gallery preview for a SmartArt {@link SmartArtLayout}.
 *
 * Renders the real `SmartArtRenderer` output for the exact element the preset
 * inserts (same layout, default items, colour scheme, and style) scaled down to
 * gallery size, so the preview always matches the chart that appears on the
 * slide. Used by `InsertSmartArtDialog.vue` to populate the gallery tiles.
 *
 * The preview element itself (box + preset node data) is built by shared's
 * `buildSmartArtPreviewElement`, the one copy every binding's gallery draws
 * from.
 */
const props = defineProps<{
	/** The layout to draw a thumbnail for. */
	layout: SmartArtLayout;
}>();

/** Gallery tile width in px. */
const PREVIEW_TILE_WIDTH = 64;

const scale = PREVIEW_TILE_WIDTH / SMARTART_PREVIEW_ELEMENT_WIDTH;

const previewElement = computed<PptxElement>(() => buildSmartArtPreviewElement(props.layout));
</script>

<template>
	<div
		class="pptx-vue-smartart-preview pointer-events-none overflow-hidden"
		:style="{
			width: `${PREVIEW_TILE_WIDTH}px`,
			height: `${Math.round(SMARTART_PREVIEW_ELEMENT_HEIGHT * scale)}px`,
		}"
		aria-hidden="true"
	>
		<div
			:style="{
				position: 'relative',
				width: `${SMARTART_PREVIEW_ELEMENT_WIDTH}px`,
				height: `${SMARTART_PREVIEW_ELEMENT_HEIGHT}px`,
				transform: `scale(${scale})`,
				transformOrigin: 'top left',
			}"
		>
			<SmartArtRenderer :element="previewElement" :z-index="0" />
		</div>
	</div>
</template>
