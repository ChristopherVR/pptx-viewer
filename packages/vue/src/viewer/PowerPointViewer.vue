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
import { computed, ref, toRef, watch } from 'vue';

import { provideViewerTheme, useThemeStyle } from '../theme';
import SlideCanvas from './components/SlideCanvas.vue';
import { useLoadContent } from './composables/useLoadContent';
import type { PowerPointViewerEmits, PowerPointViewerExpose, PowerPointViewerProps } from './types';

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
});
watch(activeSlideIndex, (index) => {
	emit('active-slide-change', index);
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

// ── Imperative surface (mirrors the React forwardRef handle) ──────────
defineExpose<PowerPointViewerExpose>({ getContent });
</script>

<template>
	<div class="pptx-vue-viewer" :class="props.class" :style="themeStyle">
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

			<div class="pptx-vue-body">
				<nav class="pptx-vue-thumbnails" aria-label="Slides">
					<button
						v-for="(slide, index) in slides"
						:key="slide.id ?? index"
						type="button"
						class="pptx-vue-thumb"
						:class="{ 'is-active': index === activeSlideIndex }"
						@click="goTo(index)"
					>
						<span class="pptx-vue-thumb-index">{{ index + 1 }}</span>
					</button>
				</nav>

				<main class="pptx-vue-main">
					<SlideCanvas
						:slide="activeSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:zoom="zoom"
					/>
				</main>
			</div>
		</template>
	</div>
</template>
