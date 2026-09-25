<script setup lang="ts">
/**
 * RibbonGalleryTile: one gallery tile button. The preview is the shared
 * descriptor's ready-made `previewSvg` (built only from catalogue data and
 * theme colours, never user text), injected as markup.
 */
import type { RibbonGalleryItem } from 'pptx-viewer-shared';

import { cn } from '../../../utils';

interface Props {
	item: RibbonGalleryItem;
	label: string;
	disabled?: boolean;
	/** Inline strip tiles are scaled to the ribbon row's height. */
	compact?: boolean;
}

const props = defineProps<Props>();
defineEmits<{ pick: [itemId: string] }>();
</script>

<template>
	<button
		type="button"
		:data-gallery-item="props.item.id"
		:aria-pressed="props.item.applied ? 'true' : 'false'"
		:aria-label="props.label"
		:title="props.label"
		:disabled="props.disabled"
		:class="
			cn(
				'inline-flex items-center justify-center rounded border p-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
				props.compact && 'h-10 [&>svg]:h-full [&>svg]:w-auto',
				props.item.applied
					? 'border-primary ring-1 ring-primary'
					: 'border-transparent enabled:hover:border-primary/60',
			)
		"
		@mousedown.prevent
		@click="$emit('pick', props.item.id)"
		v-html="props.item.previewSvg"
	/>
</template>
