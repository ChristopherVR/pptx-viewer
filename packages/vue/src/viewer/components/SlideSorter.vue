<script setup lang="ts">
/** Slide previews and reactive adapters over the shared sorter decisions. */
import { X } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import {
	buildSlideSorterContextMenuEntries,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	hiddenSlideCue,
	isEditorTextInputTarget,
	mapSlideSorterKey,
	slideSorterContextMenuLabel,
	applySorterAction,
	createSlideSorterState,
	selectSorterSlide,
	sorterSelectionIndexes,
	sorterMenuContext,
	sorterGridColumns,
} from 'pptx-viewer-shared';
import type { SlideSorterKeyActionName, SlideSorterContextMenuCommandId } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';
import ContextMenu from './ContextMenu.vue';
import type { ContextMenuItem } from './ContextMenu.vue';
import SlideStage from './SlideStage.vue';

const { t } = useI18n();

const props = defineProps<{
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	activeIndex: number;
	canEdit?: boolean;
}>();

const emit = defineEmits<{
	select: [index: number];
	reorder: [from: number, to: number];
	duplicate: [index: number];
	delete: [index: number];
	'toggle-hidden': [index: number];
	close: [];
}>();

/** Fixed thumbnail width (px); height derives from the canvas aspect ratio. */
const sorter = ref(createSlideSorterState(props.slides, props.activeIndex));
const TILE_WIDTH = computed(() => (192 * sorter.value.zoom) / 100);

const tileScale = computed(() => TILE_WIDTH.value / Math.max(1, props.canvasSize.width));
const tileHeight = computed(() => Math.round(props.canvasSize.height * tileScale.value));

const stageWrapStyle = computed<CSSProperties>(() => ({
	width: `${TILE_WIDTH.value}px`,
	height: `${tileHeight.value}px`,
}));

/**
 * The shared rail/sorter cue. The tile already dimmed and already showed the
 * word, but dimming is a colour-only signal and nothing announced the state, so
 * the tile now also carries the slash across its number and a description.
 */
const hiddenCue = hiddenSlideCue;
const slashGradient = HIDDEN_SLIDE_SLASH_GRADIENT;

/** Index of the tile currently being dragged, or `null` when idle. */
const dragIndex = ref<number | null>(null);
/** Index the dragged tile is currently hovering over (drop target preview). */
const dragOverIndex = ref<number | null>(null);

function onSelect(index: number, event: MouseEvent): void {
	sorter.value = selectSorterSlide(sorter.value, props.slides, index, event);
}

function onDragStart(index: number, event: DragEvent): void {
	dragIndex.value = index;
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'move';
		// Some browsers require data to be set for a drag to start.
		event.dataTransfer.setData('text/plain', String(index));
	}
}

function onDragOver(index: number, event: DragEvent): void {
	// Calling preventDefault marks this element as a valid drop target.
	event.preventDefault();
	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = 'move';
	}
	dragOverIndex.value = index;
}

function onDrop(index: number, event: DragEvent): void {
	event.preventDefault();
	const from = dragIndex.value;
	dragIndex.value = null;
	dragOverIndex.value = null;
	if (from === null || from === index) {
		return;
	}
	emit('reorder', from, index);
}

function onDragEnd(): void {
	dragIndex.value = null;
	dragOverIndex.value = null;
}

// ── Context menu (right-click a tile) ─────────────────────────────────
const contextMenu = ref<{ open: boolean; x: number; y: number; index: number }>({
	open: false,
	x: 0,
	y: 0,
	index: 0,
});

/**
 * Deliberately does not also `emit('select', index)`: the host's `select`
 * handler navigates the canvas AND closes this whole overlay
 * (`deckViews.onSorterSelect`), which would tear the menu down again on the
 * very right-click that opened it, before a single mouse action against it
 * was reachable.
 */
function openContextMenu(index: number, event: MouseEvent): void {
	if (!props.canEdit) {
		return;
	}
	event.preventDefault();
	sorter.value = selectSorterSlide(sorter.value, props.slides, index, {}, true);
	contextMenu.value = { open: true, x: event.clientX, y: event.clientY, index };
}

function runAction(action: SlideSorterKeyActionName | 'toggle-hidden'): void {
	const result = applySorterAction(sorter.value, props.slides, action, props.activeIndex);
	sorter.value = result.state;
	if (result.close) {
		emit('close');
	}
	for (const index of result.indexes) {
		if (result.operation === 'duplicate') {
			emit('duplicate', index);
		}
		if (result.operation === 'delete') {
			emit('delete', index);
		}
		if (result.operation === 'toggle-hidden') {
			emit('toggle-hidden', index);
		}
	}
}

const contextItems = computed<ContextMenuItem[]>(() => {
	return buildSlideSorterContextMenuEntries(sorterMenuContext(sorter.value, props.slides)).flatMap(
		(entry, position) => {
			const item: ContextMenuItem = {
				id: entry.id,
				label: slideSorterContextMenuLabel(
					t(entry.labelKey),
					entry,
					sorterSelectionIndexes(sorter.value, props.slides).length,
				),
				disabled: entry.disabled,
			};
			return entry.separatorBefore
				? [{ id: `sep-${position}`, label: '', separator: true }, item]
				: [item];
		},
	);
});

function onContextSelect(id: string): void {
	contextMenu.value.open = false;
	runAction(id as SlideSorterContextMenuCommandId);
}
function onKeyDown(event: KeyboardEvent): void {
	contextMenu.value.open = false;
	const { action } = mapSlideSorterKey(event, {
		canEdit: Boolean(props.canEdit),
		hasMultiSelection: sorterSelectionIndexes(sorter.value, props.slides).length > 1,
		isTextInputTarget: isEditorTextInputTarget(event.target),
	});
	if (!action) {
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	runAction(action);
}

onMounted(() => {
	window.addEventListener('keydown', onKeyDown);
});
onBeforeUnmount(() => {
	window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
	<div class="pptx-vue-sorter" role="dialog" :aria-label="t('pptx.slideSorter.title')">
		<header class="pptx-vue-sorter-head">
			<h2 class="pptx-vue-sorter-title">{{ t('pptx.slideSorter.title') }}</h2>
			<button
				type="button"
				class="pptx-vue-sorter-close"
				:aria-label="t('pptx.slideSorter.close')"
				@click="emit('close')"
			>
				<X :size="16" aria-hidden="true" />
			</button>
		</header>

		<div
			class="pptx-vue-sorter-grid"
			:style="{ gridTemplateColumns: `repeat(${sorterGridColumns(sorter.zoom)}, minmax(0, 1fr))` }"
		>
			<div
				v-for="(slide, index) in slides"
				:key="slide.id ?? index"
				class="pptx-vue-sorter-tile"
				:class="{
					'is-active': sorter.selectedIds.includes(slide.id),
					'is-dragging': index === dragIndex,
					'is-drop-target': index === dragOverIndex && index !== dragIndex,
					'is-hidden': Boolean(slide.hidden),
				}"
				draggable="true"
				data-pptx-chrome="sorter-tile"
				:data-index="index"
				:data-pptx-selected="sorter.selectedIds.includes(slide.id)"
				:data-pptx-slide-hidden="hiddenCue(slide.hidden, 'sorter', index).marker"
				:aria-label="t('pptx.notes.slideN', { n: index + 1 })"
				:aria-current="index === activeIndex ? 'true' : undefined"
				:aria-describedby="hiddenCue(slide.hidden, 'sorter', index).labelId"
				@click="onSelect(index, $event)"
				@dblclick="emit('select', index)"
				@contextmenu="openContextMenu(index, $event)"
				@dragstart="onDragStart(index, $event)"
				@dragover="onDragOver(index, $event)"
				@drop="onDrop(index, $event)"
				@dragend="onDragEnd"
			>
				<div class="pptx-vue-sorter-stage" :style="stageWrapStyle" aria-hidden="true">
					<SlideStage
						:slide="slide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="tileScale"
					/>
				</div>
				<span
					class="pptx-vue-sorter-index"
					:style="slide.hidden ? { backgroundImage: slashGradient } : undefined"
					>{{ index + 1 }}</span
				>
				<span
					v-if="slide.hidden"
					:id="hiddenCue(slide.hidden, 'sorter', index).labelId"
					class="pptx-vue-sorter-hidden"
					>{{ t('pptx.slideSorter.hidden') }}</span
				>
			</div>
		</div>

		<label
			>{{ t('pptx.slideSorter.zoom') }}
			<input
				type="range"
				min="50"
				max="200"
				step="10"
				v-model.number="sorter.zoom"
				:aria-label="t('pptx.slideSorter.zoom')"
			/>{{ sorter.zoom }}%</label
		>
		<ContextMenu
			:open="contextMenu.open"
			:x="contextMenu.x"
			:y="contextMenu.y"
			:items="contextItems"
			@select="onContextSelect"
			@close="contextMenu.open = false"
		/>
	</div>
</template>

<style scoped src="./slide-sorter.css"></style>
