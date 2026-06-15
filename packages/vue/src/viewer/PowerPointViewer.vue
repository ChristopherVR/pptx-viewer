<script setup lang="ts">
/**
 * PowerPointViewer — Vue port of the React `PowerPointViewer.tsx`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom. This is the viewer-first milestone of the port: the
 * React component additionally composes a full editor (toolbar, inspector
 * panels, dialogs, presentation mode, collaboration, export). The roadmap and
 * per-area status live in `packages/vue/PORTING.md`.
 *
 * Conventions vs. React:
 *  - `forwardRef` handle  → `defineExpose` ({@link PowerPointViewerExpose}).
 *  - function-prop callbacks → emits ({@link PowerPointViewerEmits}).
 *  - `theme` context      → `provideViewerTheme` + `useThemeStyle`.
 */
import { createShapeElement, createTextElement } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { computed, ref, toRef, watch } from 'vue';

import { provideViewerTheme, useThemeStyle } from '../theme';
import EditorToolbar from './components/EditorToolbar.vue';
import type { ShapePreset } from './components/EditorToolbar.vue';
import SelectionOverlay from './components/SelectionOverlay.vue';
import SlideCanvas from './components/SlideCanvas.vue';
import SlideStage from './components/SlideStage.vue';
import { useEditorHistory } from './composables/useEditorHistory';
import { useEditorOperations } from './composables/useEditorOperations';
import { useLoadContent } from './composables/useLoadContent';
import type { PowerPointViewerEmits, PowerPointViewerExpose, PowerPointViewerProps } from './types';

/** Geometry patch emitted by the selection overlay during a drag/resize/rotate. */
interface TransformPayload {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

const props = withDefaults(defineProps<PowerPointViewerProps>(), {
	canEdit: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

// ── Theme ─────────────────────────────────────────────────────────────
const theme = toRef(props, 'theme');
provideViewerTheme(theme);
const themeStyle = useThemeStyle(theme);

// ── Load + parse content ──────────────────────────────────────────────
const { slides, canvasSize, mediaDataUrls, loading, error, isEncrypted, getContent } =
	useLoadContent(() => props.content);

// ── Navigation ────────────────────────────────────────────────────────
const activeSlideIndex = ref(0);
const slideCount = computed(() => slides.value.length);
const activeSlide = computed(() => slides.value[activeSlideIndex.value]);

watch(slides, () => {
	activeSlideIndex.value = 0;
	selectedElementIds.value = [];
	history.clearHistory();
});
watch(activeSlideIndex, (index) => {
	emit('active-slide-change', index);
	selectedElementIds.value = [];
});

function goTo(index: number): void {
	if (index < 0 || index >= slideCount.value) {
		return;
	}
	activeSlideIndex.value = index;
}
const goPrev = () => goTo(activeSlideIndex.value - 1);
const goNext = () => goTo(activeSlideIndex.value + 1);

// ── Zoom ──────────────────────────────────────────────────────────────
const zoom = ref(1);
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;
const zoomIn = () => {
	zoom.value = Math.min(ZOOM_MAX, Number((zoom.value + ZOOM_STEP).toFixed(2)));
};
const zoomOut = () => {
	zoom.value = Math.max(ZOOM_MIN, Number((zoom.value - ZOOM_STEP).toFixed(2)));
};
const zoomReset = () => {
	zoom.value = 1;
};
const zoomPercent = computed(() => Math.round(zoom.value * 100));

// ── Thumbnail previews ────────────────────────────────────────────────
const THUMB_WIDTH = 104; // px — matches the thumbnail rail content width
const thumbScale = computed(() => THUMB_WIDTH / Math.max(1, canvasSize.value.width));
const thumbHeight = computed(() => Math.round(canvasSize.value.height * thumbScale.value));

// ── Editing: selection, history, operations ───────────────────────────
// Composed unconditionally (cheap); the toolbar/overlay/handlers only act when
// `props.canEdit` is true. `slides` is the writable `ShallowRef` from
// `useLoadContent`, and `getContent` serialises it — so edits flow to export.
const selectedElementIds = ref<string[]>([]);
const history = useEditorHistory(slides);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	selectedElementIds,
});
const hasSelection = computed(() => selectedElementIds.value.length > 0);
const selectedElements = computed<PptxElement[]>(() => {
	const elements = activeSlide.value?.elements ?? [];
	const ids = new Set(selectedElementIds.value);
	return elements.filter((el) => ids.has(el.id));
});

function selectElement(id: string, additive: boolean): void {
	if (additive) {
		selectedElementIds.value = selectedElementIds.value.includes(id)
			? selectedElementIds.value.filter((x) => x !== id)
			: [...selectedElementIds.value, id];
	} else {
		selectedElementIds.value = [id];
	}
}
function clearSelection(): void {
	selectedElementIds.value = [];
}

/** Click-to-select via event delegation (elements render `data-element-id`). */
function onCanvasPointerDown(event: PointerEvent): void {
	if (!props.canEdit) {
		return;
	}
	const target = event.target as HTMLElement | null;
	const host = target?.closest('[data-element-id]') as HTMLElement | null;
	const id = host?.dataset.elementId;
	if (id) {
		selectElement(id, event.shiftKey || event.ctrlKey || event.metaKey);
	} else {
		clearSelection();
	}
}

/** Patch one element's geometry on the active slide WITHOUT a history entry. */
function patchActiveElementGeometry(payload: TransformPayload): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	const nextElements = slide.elements.map((el) =>
		el.id === payload.id
			? {
					...el,
					x: payload.x,
					y: payload.y,
					width: payload.width,
					height: payload.height,
					rotation: payload.rotation,
				}
			: el,
	);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}

// One history entry per gesture: snapshot on start, live-patch (no history)
// during the drag and on commit.
function onTransformStart(): void {
	history.pushHistory();
}
function onTransform(payload: TransformPayload): void {
	patchActiveElementGeometry(payload);
}
function onTransformEnd(payload: TransformPayload): void {
	patchActiveElementGeometry(payload);
}

/** Centre a newly-created element (default box) on the slide. */
function centreNewElement(el: PptxElement, width: number, height: number): void {
	el.width = width;
	el.height = height;
	el.x = Math.max(0, Math.round((canvasSize.value.width - width) / 2));
	el.y = Math.max(0, Math.round((canvasSize.value.height - height) / 2));
}

function addText(): void {
	const el = createTextElement('Text');
	centreNewElement(el, 320, 80);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}
function addShape(preset: ShapePreset): void {
	const el = createShapeElement(preset);
	centreNewElement(el, 240, 160);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}
function deleteSelected(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.removeElement(id);
	}
	clearSelection();
}
function duplicateSelected(): void {
	const next: string[] = [];
	for (const id of [...selectedElementIds.value]) {
		const newId = ops.duplicateElement(id);
		if (newId) {
			next.push(newId);
		}
	}
	if (next.length > 0) {
		selectedElementIds.value = next;
	}
}
function bringForward(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.bringForward(id);
	}
}
function sendBackward(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.sendBackward(id);
	}
}

/** Keyboard editing shortcuts (only while editable). */
function onEditorKeydown(event: KeyboardEvent): void {
	if (!props.canEdit) {
		return;
	}
	const mod = event.ctrlKey || event.metaKey;
	if (mod && event.key.toLowerCase() === 'z') {
		event.preventDefault();
		if (event.shiftKey) {
			history.redo();
		} else {
			history.undo();
		}
		return;
	}
	if (mod && event.key.toLowerCase() === 'y') {
		event.preventDefault();
		history.redo();
		return;
	}
	if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection.value) {
		event.preventDefault();
		deleteSelected();
	}
}

// ── Imperative surface (mirrors the React forwardRef handle) ──────────
defineExpose<PowerPointViewerExpose>({ getContent });
</script>

<template>
	<div
		class="pptx-vue-viewer"
		:class="props.class"
		:style="themeStyle"
		:tabindex="props.canEdit ? 0 : undefined"
		@keydown="onEditorKeydown"
	>
		<!-- Loading -->
		<div v-if="loading" class="pptx-vue-state pptx-vue-loading">
			<div class="pptx-vue-spinner" aria-hidden="true" />
			<p>Loading presentation…</p>
		</div>

		<!-- Encrypted -->
		<div v-else-if="isEncrypted" class="pptx-vue-state pptx-vue-error">
			<p>This presentation is password-protected and cannot be opened.</p>
		</div>

		<!-- Error -->
		<div v-else-if="error" class="pptx-vue-state pptx-vue-error">
			<p>Failed to load presentation.</p>
			<pre class="pptx-vue-error-detail">{{ error }}</pre>
		</div>

		<!-- Viewer -->
		<template v-else>
			<header class="pptx-vue-toolbar">
				<div class="pptx-vue-nav">
					<button type="button" :disabled="activeSlideIndex <= 0" @click="goPrev">‹</button>
					<span class="pptx-vue-slide-counter">
						{{ slideCount === 0 ? 0 : activeSlideIndex + 1 }} / {{ slideCount }}
					</span>
					<button type="button" :disabled="activeSlideIndex >= slideCount - 1" @click="goNext">
						›
					</button>
				</div>
				<div class="pptx-vue-zoom">
					<button type="button" @click="zoomOut">−</button>
					<button type="button" class="pptx-vue-zoom-value" @click="zoomReset">
						{{ zoomPercent }}%
					</button>
					<button type="button" @click="zoomIn">+</button>
				</div>
			</header>

			<!-- Editing toolbar -->
			<EditorToolbar
				v-if="props.canEdit"
				:can-undo="history.canUndo.value"
				:can-redo="history.canRedo.value"
				:zoom-percent="zoomPercent"
				:has-selection="hasSelection"
				@undo="history.undo"
				@redo="history.redo"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@zoom-reset="zoomReset"
				@add-text="addText"
				@add-shape="addShape"
				@delete-selected="deleteSelected"
				@duplicate-selected="duplicateSelected"
				@bring-forward="bringForward"
				@send-backward="sendBackward"
			/>

			<div class="pptx-vue-body">
				<nav class="pptx-vue-thumbnails" aria-label="Slides">
					<button
						v-for="(slide, index) in slides"
						:key="slide.id ?? index"
						type="button"
						class="pptx-vue-thumb"
						:class="{ 'is-active': index === activeSlideIndex }"
						:style="{ height: `${thumbHeight}px` }"
						:aria-label="`Slide ${index + 1}`"
						:aria-current="index === activeSlideIndex ? 'true' : undefined"
						@click="goTo(index)"
					>
						<div class="pptx-vue-thumb-stage" aria-hidden="true">
							<SlideStage
								:slide="slide"
								:canvas-size="canvasSize"
								:media-data-urls="mediaDataUrls"
								:scale="thumbScale"
							/>
						</div>
						<span class="pptx-vue-thumb-index">{{ index + 1 }}</span>
					</button>
				</nav>

				<main class="pptx-vue-main" @pointerdown="onCanvasPointerDown">
					<SlideCanvas
						:slide="activeSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:zoom="zoom"
					>
						<SelectionOverlay
							v-if="props.canEdit"
							:elements="selectedElements"
							:selected-ids="selectedElementIds"
							:zoom="zoom"
							@transform-start="onTransformStart"
							@transform="onTransform"
							@transform-end="onTransformEnd"
						/>
					</SlideCanvas>
				</main>
			</div>
		</template>
	</div>
</template>
