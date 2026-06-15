<script setup lang="ts">
/**
 * SlideSorter — a full-overlay grid overview of every slide with
 * drag-to-reorder support.
 *
 * Each tile renders the real slide via {@link SlideStage} scaled down to a
 * small fixed width, so the overview stays visually faithful to the canvas
 * and thumbnail rail. Tiles are reordered with native HTML5 drag-and-drop
 * (`draggable` + `dragstart`/`dragover`/`drop`); the component itself never
 * mutates the slide list — it emits `reorder(from, to)` and lets the host
 * apply the move (e.g. via `slideOps.moveSlide`).
 *
 * Conventions:
 *  - Callbacks → emits: `select`, `reorder`, `close`.
 *  - Presentational only; all slide state is owned by the host.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const props = defineProps<{
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	activeIndex: number;
}>();

const emit = defineEmits<{
	select: [index: number];
	reorder: [from: number, to: number];
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
</script>

<template>
	<div class="pptx-vue-sorter" role="dialog" aria-label="Slide sorter">
		<header class="pptx-vue-sorter-head">
			<h2 class="pptx-vue-sorter-title">Slide sorter</h2>
			<button
				type="button"
				class="pptx-vue-sorter-close"
				aria-label="Close slide sorter"
				@click="emit('close')"
			>
				×
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
				}"
				draggable="true"
				:data-index="index"
				:aria-label="`Slide ${index + 1}`"
				:aria-current="index === activeIndex ? 'true' : undefined"
				@click="onSelect(index)"
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
				<span class="pptx-vue-sorter-index">{{ index + 1 }}</span>
			</div>
		</div>
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
</style>
