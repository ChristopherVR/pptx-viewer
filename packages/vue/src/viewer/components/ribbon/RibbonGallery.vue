<script setup lang="ts">
/**
 * RibbonGallery: one ribbon style gallery (Shape Styles, WordArt Styles,
 * Bullets, Theme Colors, ...), rendered from the shared descriptor.
 *
 * - `dropdown`: a trigger button (icon + caption + chevron) opening the panel.
 * - `inline`: the first tiles directly in the ribbon plus a "more" button.
 * - `chevron` (a dropdown variant): only a small chevron trigger, for the
 *   Bullets / Numbering libraries sitting beside their toggle buttons.
 *
 * DOM contract (shared `gallery-view.ts`, identical across bindings): the
 * trigger carries `data-ribbon-gallery`, the wrapper `data-ribbon-control`,
 * the panel `data-ribbon-gallery-popup`, each tile `data-gallery-item`.
 */
import { ChevronDown } from 'lucide-vue-next';
import type { RibbonControlId, RibbonGalleryId } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { cn } from '../../../utils';
import { GALLERY_ICONS } from './gallery-icons';
import { ic, pill } from './ribbon-constants';
import RibbonGalleryPopup from './RibbonGalleryPopup.vue';
import RibbonGalleryTile from './RibbonGalleryTile.vue';
import { useDropdown } from './use-dropdown';
import { useRibbonGallery } from './use-ribbon-gallery';

interface Props {
	gallery: RibbonGalleryId;
	/** Catalogue id for the wrapper; omit when the parent's wrapper carries it. */
	control?: RibbonControlId;
	mode: 'inline' | 'dropdown' | 'chevron';
}

const props = defineProps<Props>();
const g = useRibbonGallery(() => props.gallery);
const menu = useDropdown();
const icon = computed(() => GALLERY_ICONS[props.gallery]);
const moreLabel = computed(() => g.translate('pptx.gallery.more', { name: g.title.value }));

function onPick(itemId: string): void {
	g.pick(itemId);
	menu.close();
}
</script>

<template>
	<div
		:ref="menu.root"
		class="relative inline-flex items-stretch"
		:data-ribbon-control="props.control"
		@keydown.escape="menu.close()"
	>
		<template v-if="props.mode === 'inline'">
			<div
				class="inline-flex items-center gap-0.5 rounded-l border border-border/60 bg-background/40 p-0.5"
			>
				<RibbonGalleryTile
					v-for="item in g.inlineItems.value"
					:key="item.id"
					:item="item"
					:label="g.itemLabel(item)"
					:disabled="g.disabled.value"
					compact
					@pick="onPick"
				/>
			</div>
			<button
				type="button"
				:data-ribbon-gallery="props.gallery"
				:disabled="g.disabled.value"
				:aria-label="moreLabel"
				:title="moreLabel"
				aria-haspopup="dialog"
				:aria-expanded="menu.open.value ? 'true' : 'false'"
				class="inline-flex items-center rounded-r border border-l-0 border-border/60 bg-muted px-0.5 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
				@click="menu.toggle()"
			>
				<ChevronDown class="w-3 h-3" />
			</button>
		</template>
		<button
			v-else
			type="button"
			:data-ribbon-gallery="props.gallery"
			:disabled="g.disabled.value"
			:aria-label="g.title.value"
			:title="g.title.value"
			aria-haspopup="dialog"
			:aria-expanded="menu.open.value ? 'true' : 'false'"
			:class="
				cn(
					props.mode === 'chevron'
						? 'inline-flex items-center self-stretch px-0.5 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed'
						: cn(pill, 'disabled:opacity-40 disabled:cursor-not-allowed'),
				)
			"
			@mousedown.prevent
			@click="menu.toggle()"
		>
			<template v-if="props.mode === 'dropdown'">
				<component :is="icon" :class="ic" />
				{{ g.title.value }}
			</template>
			<ChevronDown class="w-3 h-3" />
		</button>
		<RibbonGalleryPopup
			v-if="menu.open.value && !g.disabled.value"
			:descriptor="g.descriptor.value"
			:anchor="menu.root.value"
			:title="g.title.value"
			:item-label="g.itemLabel"
			:section-title="g.sectionTitle"
			@pick="onPick"
		/>
	</div>
</template>
