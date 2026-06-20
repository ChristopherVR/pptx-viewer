<script setup lang="ts">
import { EyeOff, MessageSquare, Plus } from 'lucide-vue-next';
/**
 * SlidesPaneSidebar - Vue port of React's `SlidesPaneSidebar` + `SlideItem`.
 *
 * The flat slide rail: a scrollable list of number-left thumbnails (active slide
 * gets a left primary bar + accent background), drag-to-reorder, a right-click
 * context menu (Duplicate / Delete / Hide), and a bottom "Add slide" button.
 * Class strings are copied from React's `SlideItem`/`SlidesPaneSidebar` for
 * visual parity; `react-icons/lu` glyphs map to `lucide-vue-next`.
 *
 * Sectioned decks keep using `SectionList`; this renders the non-sectioned case
 * (React's `renderNonVirtualized` without section headers). Virtualization for
 * very large decks is not ported (the host decks are small).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

import { cn } from '../../utils';
import type { CanvasSize } from '../types';
import ContextMenu from './ContextMenu.vue';
import type { ContextMenuItem } from './ContextMenu.vue';
import SlideStage from './SlideStage.vue';

const props = withDefaults(
	defineProps<{
		slides: PptxSlide[];
		activeIndex: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		canEdit: boolean;
		/** Thumbnail content width in px (matches React's SLIDE_NAV_THUMBNAIL_WIDTH). */
		thumbWidth?: number;
	}>(),
	{ thumbWidth: 104 },
);

const emit = defineEmits<{
	select: [index: number];
	reorder: [payload: { from: number; to: number }];
	'add-slide': [];
	duplicate: [index: number];
	delete: [index: number];
	'toggle-hidden': [index: number];
}>();

const scale = computed(() => props.thumbWidth / Math.max(1, props.canvasSize.width));
const previewHeight = computed(() =>
	Math.max(56, Math.round(props.canvasSize.height * scale.value)),
);

// ── Drag-to-reorder ──
const dragFrom = ref<number | null>(null);
function onDragStart(e: DragEvent, index: number): void {
	dragFrom.value = index;
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = 'move';
	}
}
function onDrop(index: number): void {
	if (dragFrom.value !== null && dragFrom.value !== index) {
		emit('reorder', { from: dragFrom.value, to: index });
	}
	dragFrom.value = null;
}

// ── Slide context menu ──
const menu = ref<{ open: boolean; x: number; y: number; index: number }>({
	open: false,
	x: 0,
	y: 0,
	index: -1,
});
const menuItems = computed<ContextMenuItem[]>(() => [
	{ id: 'duplicate', label: 'Duplicate slide' },
	{ id: 'delete', label: 'Delete slide', disabled: props.slides.length <= 1 },
	{ id: 'sep', label: '', separator: true },
	{
		id: 'toggle-hidden',
		label: props.slides[menu.value.index]?.hidden ? 'Show slide' : 'Hide slide',
	},
]);
function onContextMenu(e: MouseEvent, index: number): void {
	if (!props.canEdit) {
		return;
	}
	e.preventDefault();
	menu.value = { open: true, x: e.clientX, y: e.clientY, index };
}
function onMenuSelect(id: string): void {
	const i = menu.value.index;
	menu.value.open = false;
	if (i < 0) {
		return;
	}
	if (id === 'duplicate') {
		emit('duplicate', i);
	} else if (id === 'delete') {
		emit('delete', i);
	} else if (id === 'toggle-hidden') {
		emit('toggle-hidden', i);
	}
}
</script>

<template>
	<aside
		role="navigation"
		aria-label="Slides"
		class="flex h-full flex-col border-r border-border bg-secondary/30 shrink-0"
		:style="{ width: `${thumbWidth + 46}px` }"
	>
		<div class="flex-1 space-y-1 overflow-y-auto px-1.5 pb-2 pt-1.5">
			<div
				v-for="(slide, index) in slides"
				:key="slide.id ?? index"
				:class="
					cn(
						'group relative flex items-center gap-1 cursor-pointer py-0.5 px-1 transition-all',
						index === activeIndex &&
							'bg-accent/40 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-primary before:rounded-r',
						slide.hidden && 'opacity-50',
					)
				"
				:draggable="canEdit"
				:aria-label="`Slide ${index + 1}`"
				:aria-current="index === activeIndex ? 'true' : undefined"
				@click="emit('select', index)"
				@contextmenu="onContextMenu($event, index)"
				@dragstart="onDragStart($event, index)"
				@dragover.prevent
				@drop="onDrop(index)"
			>
				<!-- Slide number column -->
				<div class="flex flex-col items-center gap-0.5 w-5 shrink-0">
					<span
						:class="
							cn(
								'text-[10px] tabular-nums text-right select-none w-full',
								index === activeIndex ? 'text-primary font-medium' : 'text-muted-foreground',
							)
						"
					>
						{{ index + 1 }}
					</span>
				</div>

				<!-- Thumbnail -->
				<div
					:class="
						cn(
							'relative flex-1 overflow-hidden border transition-colors bg-white',
							index === activeIndex
								? 'border-primary/60'
								: 'border-transparent group-hover:border-border/40',
						)
					"
					:style="{ height: `${previewHeight}px` }"
				>
					<SlideStage
						:slide="slide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="scale"
					/>
					<div
						v-if="(slide.comments?.length ?? 0) > 0"
						class="absolute top-0.5 right-0.5 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[8px] font-medium text-white leading-none z-10"
					>
						<MessageSquare class="w-2 h-2" />
						{{ slide.comments?.length }}
					</div>
					<div v-if="slide.hidden" class="absolute bottom-0.5 right-0.5 z-10">
						<EyeOff class="w-3 h-3 text-muted-foreground" />
					</div>
				</div>
			</div>
		</div>

		<!-- Bottom: Add Slide -->
		<div v-if="canEdit" class="border-t border-border/60 px-2 py-1.5">
			<button
				type="button"
				class="flex w-full items-center justify-center gap-1 rounded-sm px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
				@click="emit('add-slide')"
			>
				<Plus class="h-3 w-3" />
				Add slide
			</button>
		</div>

		<ContextMenu
			:open="menu.open"
			:x="menu.x"
			:y="menu.y"
			:items="menuItems"
			@select="onMenuSelect"
			@close="menu.open = false"
		/>
	</aside>
</template>
