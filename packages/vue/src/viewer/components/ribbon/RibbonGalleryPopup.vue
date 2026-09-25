<script setup lang="ts">
/**
 * RibbonGalleryPopup: the dropped-down panel of a ribbon gallery. Renders
 * every descriptor section (optional heading, then a `columns`-wide grid of
 * tiles), pinned under its trigger with the ribbon's `v-anchored-popup`.
 */
import type {
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
	RibbonGallerySection,
} from 'pptx-viewer-shared';

import { vAnchoredPopup } from './anchored-popup';
import RibbonGalleryTile from './RibbonGalleryTile.vue';

interface Props {
	descriptor: RibbonGalleryDescriptor;
	anchor: HTMLElement | null | undefined;
	title: string;
	itemLabel: (item: RibbonGalleryItem) => string;
	sectionTitle: (section: RibbonGallerySection) => string | undefined;
}

const props = defineProps<Props>();
defineEmits<{ pick: [itemId: string] }>();
</script>

<template>
	<div class="z-50 flex flex-col pt-1" v-anchored-popup="{ anchor: props.anchor }">
		<div
			:data-ribbon-gallery-popup="props.descriptor.id"
			role="dialog"
			:aria-label="props.title"
			class="max-h-[420px] max-w-[560px] overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-2xl backdrop-blur-lg"
		>
			<section
				v-for="section in props.descriptor.sections"
				:key="section.id"
				class="mb-2 last:mb-0"
			>
				<div
					v-if="props.sectionTitle(section)"
					class="mb-1 px-1 text-[10px] font-medium text-muted-foreground"
				>
					{{ props.sectionTitle(section) }}
				</div>
				<div
					class="grid gap-1"
					:style="{ gridTemplateColumns: `repeat(${section.columns}, max-content)` }"
				>
					<RibbonGalleryTile
						v-for="item in section.items"
						:key="item.id"
						:item="item"
						:label="props.itemLabel(item)"
						@pick="$emit('pick', $event)"
					/>
				</div>
			</section>
		</div>
	</div>
</template>
