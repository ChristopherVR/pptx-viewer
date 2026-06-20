<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { RULER_THICKNESS } from '../composables/ruler-utils';
import type { CanvasSize } from '../types';
import RulerStrips from './RulerStrips.vue';
import SlideStage from './SlideStage.vue';

/**
 * SlideCanvas - Vue port of the React `SlideCanvas.tsx` (viewer-first subset).
 *
 * Centres a {@link SlideStage} in a scrollable viewport with a drop shadow.
 * The React version additionally layered in rulers, grid, guides, marquee/
 * selection, connector-creation, drawing, and collaboration overlays, all
 * tracked in PORTING.md.
 *
 * Responsive sizing: the slide has a fixed authored pixel size (e.g. 1280×720),
 * which overflows small/mobile viewports. We measure the scroll viewport and
 * emit a `fitScale` (how much the slide must shrink to fit, capped at 1, never
 * upscaling) so the parent can fold it into the effective zoom, mirroring the
 * React viewer's `fitScale * scale` model where "100%" means "fit to viewport".
 */
const props = defineProps<{
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Effective scale (fitScale × user zoom) supplied by the parent. */
	zoom?: number;
	/** Show the horizontal/vertical rulers along the slide edges (View ▸ Rulers). */
	showRulers?: boolean;
}>();

const emit = defineEmits<{ 'update:fitScale': [number] }>();

const scale = computed(() => props.zoom ?? 1);

const wrapperStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width * scale.value}px`,
	height: `${props.canvasSize.height * scale.value}px`,
	position: 'relative',
	// Reserve room above for the horizontal ruler when it's shown.
	margin: props.showRulers ? `${RULER_THICKNESS + 8}px auto 1rem` : '1rem auto',
	boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
}));

const viewportRef = ref<HTMLElement | null>(null);

/**
 * Compute and emit the largest scale (≤ 1) at which the whole slide fits inside
 * the available viewport. Leaves a small margin so the drop shadow / `1rem`
 * gutter is not clipped. Emits 1 when the viewport is unmeasured.
 */
function recomputeFit(): void {
	const el = viewportRef.value;
	const { width, height } = props.canvasSize;
	if (!el || !width || !height) {
		emit('update:fitScale', 1);
		return;
	}
	// Reserve the 1rem (16px) top/bottom margin and a little horizontal breathing
	// room so the slide and its shadow are never flush against the edges.
	const availW = Math.max(el.clientWidth - 16, 0);
	const availH = Math.max(el.clientHeight - 32, 0);
	if (!availW || !availH) {
		emit('update:fitScale', 1);
		return;
	}
	const fit = Math.min(availW / width, availH / height, 1);
	emit('update:fitScale', fit > 0 ? fit : 1);
}

let observer: ResizeObserver | null = null;

onMounted(() => {
	recomputeFit();
	if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
		observer = new ResizeObserver(() => recomputeFit());
		observer.observe(viewportRef.value);
	}
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
});

// Re-fit when the authored slide size changes (e.g. switching decks).
watch(() => [props.canvasSize.width, props.canvasSize.height], recomputeFit);
</script>

<template>
	<div ref="viewportRef" class="pptx-vue-canvas-viewport" data-pptx-viewport>
		<div
			class="pptx-vue-canvas-wrapper"
			:style="wrapperStyle"
			role="region"
			aria-roledescription="slide"
			aria-label="Slide"
		>
			<RulerStrips v-if="showRulers" :canvas-size="canvasSize" :scale="scale" />
			<SlideStage
				:slide="slide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				interactive
			>
				<slot />
			</SlideStage>
		</div>
	</div>
</template>
