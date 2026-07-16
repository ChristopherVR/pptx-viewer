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
 * and virtualizes decks at the same 50-slide threshold as React.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { computeVirtualRange, SLIDE_VIRTUALIZATION_THRESHOLD } from 'pptx-viewer-shared';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n();

const scale = computed(() => props.thumbWidth / Math.max(1, props.canvasSize.width));
const previewHeight = computed(() =>
	Math.max(56, Math.round(props.canvasSize.height * scale.value)),
);
const listEl = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(600);
const itemHeight = computed(() => previewHeight.value + 5);
const shouldVirtualize = computed(() => props.slides.length >= SLIDE_VIRTUALIZATION_THRESHOLD);
const virtualRange = computed(() =>
	computeVirtualRange(props.slides.length, itemHeight.value, scrollTop.value, viewportHeight.value),
);
const renderedSlides = computed(() => {
	const start = shouldVirtualize.value ? virtualRange.value.startIndex : 0;
	const end = shouldVirtualize.value ? virtualRange.value.endIndex : props.slides.length - 1;
	return props.slides
		.slice(start, end + 1)
		.map((slide, offset) => ({ slide, index: start + offset }));
});
function onScroll(): void {
	const el = listEl.value;
	if (!el) {
		return;
	}
	scrollTop.value = el.scrollTop;
	viewportHeight.value = el.clientHeight || 600;
}
watch(
	[() => props.activeIndex, itemHeight],
	async ([index]) => {
		await nextTick();
		const el = listEl.value;
		if (!el || !shouldVirtualize.value) {
			return;
		}
		const viewport = el.clientHeight || 600;
		const top = index * itemHeight.value;
		const bottom = top + itemHeight.value;
		if (top < el.scrollTop) {
			el.scrollTop = top;
		} else if (bottom > el.scrollTop + viewport) {
			el.scrollTop = Math.max(0, bottom - viewport);
		}
		onScroll();
	},
	{ immediate: true },
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
	{ id: 'duplicate', label: t('pptx.slideMenu.duplicate') },
	{ id: 'delete', label: t('pptx.slideMenu.delete'), disabled: props.slides.length <= 1 },
	{ id: 'sep', label: '', separator: true },
	{
		id: 'toggle-hidden',
		label: props.slides[menu.value.index]?.hidden
			? t('pptx.slideMenu.show')
			: t('pptx.slideMenu.hide'),
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
		:aria-label="t('pptx.sections.slides')"
		class="flex h-full flex-col border-r border-border bg-secondary/30 shrink-0"
		:style="{ width: `${thumbWidth + 46}px` }"
	>
		<div ref="listEl" class="flex-1 overflow-y-auto px-1.5 pb-2 pt-1.5" @scroll="onScroll">
			<div
				:data-virtualized="shouldVirtualize ? 'true' : undefined"
				:style="
					shouldVirtualize
						? { height: `${virtualRange.totalHeight}px`, position: 'relative' }
						: undefined
				"
			>
				<div
					class="space-y-1"
					:style="
						shouldVirtualize
							? {
									position: 'absolute',
									insetInline: '0',
									top: `${virtualRange.offsetY}px`,
								}
							: undefined
					"
				>
					<button
						v-for="{ slide, index } in renderedSlides"
						:key="slide.id ?? index"
						type="button"
						:class="
							cn(
								'group relative flex w-full items-center gap-1 cursor-pointer border-0 bg-transparent py-0.5 px-1 text-left transition-all',
								index === activeIndex &&
									'bg-accent/40 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-primary before:rounded-r',
								slide.hidden && 'opacity-50',
							)
						"
						:draggable="canEdit"
						:data-slide-index="index"
						:aria-label="t('pptx.slidesPanel.goToSlide', { n: index + 1 })"
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
					</button>
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
				{{ t('pptx.slideMenu.addSlide') }}
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
