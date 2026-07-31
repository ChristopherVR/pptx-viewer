<script setup lang="ts">
/**
 * SlideSorter - a full-overlay grid overview of every slide with
 * drag-to-reorder support.
 *
 * Each tile renders the real slide via {@link SlideStage} scaled down to a
 * small fixed width, so the overview stays visually faithful to the canvas
 * and thumbnail rail. Tiles are reordered with native HTML5 drag-and-drop
 * (`draggable` + `dragstart`/`dragover`/`drop`); the component itself never
 * mutates the slide list; it emits `reorder(from, to)` and lets the host
 * apply the move (e.g. via `slideOps.moveSlide`).
 *
 * Conventions:
 *  - Callbacks → emits: `select`, `reorder`, `close`.
 *  - Presentational only; all slide state is owned by the host.
 */
import { X } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import { HIDDEN_SLIDE_SLASH_GRADIENT, hiddenSlideCue } from 'pptx-viewer-shared';
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
const TILE_WIDTH = 192;

const tileScale = computed(() => TILE_WIDTH / Math.max(1, props.canvasSize.width));
const tileHeight = computed(() => Math.round(props.canvasSize.height * tileScale.value));

const stageWrapStyle = computed<CSSProperties>(() => ({
	width: `${TILE_WIDTH}px`,
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

function onSelect(index: number): void {
	emit('select', index);
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

function openContextMenu(index: number, event: MouseEvent): void {
	if (!props.canEdit) {
		return;
	}
	event.preventDefault();
	emit('select', index);
	contextMenu.value = { open: true, x: event.clientX, y: event.clientY, index };
}

const contextItems = computed<ContextMenuItem[]>(() => {
	const hidden = props.slides[contextMenu.value.index]?.hidden ?? false;
	return [
		{ id: 'duplicate', label: t('pptx.slideMenu.duplicate') },
		{ id: 'toggle-hidden', label: hidden ? t('pptx.slideMenu.show') : t('pptx.slideMenu.hide') },
		{ id: 'sep', label: '', separator: true },
		{ id: 'delete', label: t('pptx.slideMenu.delete') },
	];
});

function onContextSelect(id: string): void {
	const index = contextMenu.value.index;
	contextMenu.value.open = false;
	if (id === 'duplicate') {
		emit('duplicate', index);
	} else if (id === 'toggle-hidden') {
		emit('toggle-hidden', index);
	} else if (id === 'delete') {
		emit('delete', index);
	}
}

// ── Keyboard shortcuts (Delete / Ctrl+D / Escape) ─────────────────────
function onKeyDown(event: KeyboardEvent): void {
	if (contextMenu.value.open) {
		contextMenu.value.open = false;
	}
	const isCtrl = event.ctrlKey || event.metaKey;
	if (event.key === 'Escape') {
		event.stopPropagation();
		emit('close');
		return;
	}
	if (!props.canEdit) {
		return;
	}
	if (event.key === 'Delete' || event.key === 'Backspace') {
		event.preventDefault();
		emit('delete', props.activeIndex);
		return;
	}
	if (isCtrl && (event.key === 'd' || event.key === 'D')) {
		event.preventDefault();
		emit('duplicate', props.activeIndex);
	}
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

		<div class="pptx-vue-sorter-grid">
			<div
				v-for="(slide, index) in slides"
				:key="slide.id ?? index"
				class="pptx-vue-sorter-tile"
				:class="{
					'is-active': index === activeIndex,
					'is-dragging': index === dragIndex,
					'is-drop-target': index === dragOverIndex && index !== dragIndex,
					'is-hidden': Boolean(slide.hidden),
				}"
				draggable="true"
				:data-index="index"
				:data-pptx-slide-hidden="hiddenCue(slide.hidden, 'sorter', index).marker"
				:aria-label="t('pptx.notes.slideN', { n: index + 1 })"
				:aria-current="index === activeIndex ? 'true' : undefined"
				:aria-describedby="hiddenCue(slide.hidden, 'sorter', index).labelId"
				@click="onSelect(index)"
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

<style scoped>
.pptx-vue-sorter {
	position: absolute;
	inset: 0;
	z-index: 20;
	display: flex;
	flex-direction: column;
	background: var(--pptx-bg, #1e1e1e);
}

.pptx-vue-sorter-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--pptx-border, #333);
	background: var(--pptx-card, #252525);
}

.pptx-vue-sorter-title {
	margin: 0;
	font-size: 0.95rem;
	font-weight: 600;
	color: var(--pptx-fg, #f3f4f6);
}

.pptx-vue-sorter-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.75rem;
	height: 1.75rem;
	padding: 0;
	font-size: 1.25rem;
	line-height: 1;
	color: var(--pptx-fg, #f3f4f6);
	background: transparent;
	border: 1px solid var(--pptx-border, #333);
	border-radius: 0.375rem;
	cursor: pointer;
}

.pptx-vue-sorter-close:hover {
	background: var(--pptx-border, #333);
}

.pptx-vue-sorter-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(192px, 1fr));
	gap: 1rem;
	padding: 1rem;
	overflow-y: auto;
}

.pptx-vue-sorter-tile {
	position: relative;
	display: flex;
	flex-direction: column;
	padding: 0;
	overflow: hidden;
	border: 2px solid var(--pptx-border, #333);
	border-radius: 0.5rem;
	background: #ffffff;
	cursor: grab;
}

.pptx-vue-sorter-tile.is-active {
	border-color: var(--pptx-primary, #2563eb);
}

.pptx-vue-sorter-tile.is-dragging {
	opacity: 0.45;
}

.pptx-vue-sorter-tile.is-drop-target {
	outline: 2px dashed var(--pptx-primary, #2563eb);
	outline-offset: -2px;
}

/* Mini slide preview; non-interactive so drag/click target the tile. */
.pptx-vue-sorter-stage {
	position: relative;
	overflow: hidden;
	pointer-events: none;
}

.pptx-vue-sorter-index {
	position: absolute;
	bottom: 0.25rem;
	right: 0.35rem;
	padding: 0 0.3rem;
	font-size: 0.7rem;
	color: #f3f4f6;
	background: rgba(0, 0, 0, 0.55);
	border-radius: 0.2rem;
}

.pptx-vue-sorter-hidden {
	position: absolute;
	top: 0.25rem;
	left: 0.35rem;
	padding: 0 0.3rem;
	font-size: 0.65rem;
	color: #f3f4f6;
	background: rgba(0, 0, 0, 0.65);
	border-radius: 0.2rem;
}

.pptx-vue-sorter-tile.is-hidden .pptx-vue-sorter-stage {
	opacity: 0.5;
}
</style>
