<script setup lang="ts">
import type { RibbonControlId, RibbonGalleryId, RibbonGalleryPickEvent } from 'pptx-viewer-shared';

import { useRibbonGallery } from './use-ribbon-gallery';

const props = defineProps<{
	gallery: RibbonGalleryId;
	control?: RibbonControlId;
	mode: 'inline' | 'dropdown' | 'chevron';
}>();
const g = useRibbonGallery(() => props.gallery);
function pick(event: Event): void {
	g.pick((event as RibbonGalleryPickEvent).detail.itemId);
}
</script>
<template>
	<pptx-ui-ribbon-gallery
		:data-ribbon-control="props.control"
		:mode="props.mode === 'inline' ? 'inline' : 'dropdown'"
		:chevron-only="props.mode === 'chevron' || undefined"
		:descriptor.prop="g.descriptor.value"
		:translateLabel.prop="g.translate"
		:disabled.prop="g.disabled.value"
		@gallery-pick="pick"
	></pptx-ui-ribbon-gallery>
</template>
