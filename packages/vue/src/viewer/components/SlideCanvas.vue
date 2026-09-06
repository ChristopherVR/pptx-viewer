<script setup lang="ts">
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { getSlideBackgroundStyle } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { RULER_THICKNESS } from '../composables/ruler-utils';
import type { RulerUnit } from '../composables/ruler-utils';
import type { CanvasSize } from '../types';
import RulerStrips from './RulerStrips.vue';
import SlideStage from './SlideStage.vue';

/**
 * SlideCanvas - Vue port of the React `SlideCanvas.tsx`.
 *
 * Centres a {@link SlideStage} in a scrollable viewport with a drop shadow.
 * The rulers, grid, guides, marquee/selection, connector-creation, drawing,
 * and collaboration overlays are layered in by the surrounding viewer
 * components.
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
	/** Unit system for the ruler labels; defaults to inches, as PowerPoint does. */
	rulerUnit?: RulerUnit;
	/** Selected element extent (unscaled slide px) highlighted on the rulers. */
	rulerSelectedBounds?: { x: number; y: number; width: number; height: number } | null;
	/** Allow dragging a guide off a ruler strip (editing only). */
	canDragGuides?: boolean;
	/**
	 * Master/layout (template) elements for the active slide, rendered by
	 * {@link SlideStage} in a dedicated layer behind the slide content.
	 */
	templateElements?: PptxElement[];
	/**
	 * When on, master/layout (template) elements become interactive on the canvas
	 * and gain a visual affordance. Threaded down to {@link SlideStage}.
	 */
	editTemplateMode?: boolean;
	/**
	 * The element currently open in the element-level inline text editor;
	 * threaded down to {@link SlideStage} so it can suppress that element's own
	 * static text render while the editor overlay draws it instead.
	 */
	inlineEditingElementId?: string | null;
}>();

const emit = defineEmits<{
	'update:fitScale': [number];
	/** Guide dragged off a ruler strip (axis + unscaled slide-local position). */
	createGuide: [axis: 'h' | 'v', position: number];
}>();

const { t } = useI18n();

const scale = computed(() => props.zoom ?? 1);

const wrapperStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width * scale.value}px`,
	height: `${props.canvasSize.height * scale.value}px`,
	position: 'relative',
	flex: 'none',
	// Reserve room above for the horizontal ruler when it's shown; the
	// remaining space centers both horizontally and vertically since the
	// viewport is a flex container (`margin: auto` on a flex item consumes
	// all free space on both axes, matching the Svelte binding).
	margin: props.showRulers ? `${RULER_THICKNESS + 8}px auto auto` : 'auto',
	boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
	// Paint the resolved slide background on the labelled slide region so a
	// master/layout-inherited background is exposed on the aria-roledescription
	// ="slide" node, matching React/Angular (the inner SlideStage repaints it).
	...(getSlideBackgroundStyle(props.slide, {
		widthPx: props.canvasSize.width,
		heightPx: props.canvasSize.height,
	}) as CSSProperties),
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
	//
	// With rulers on, reserve their thickness too: the strips are drawn just
	// OUTSIDE the wrapper (top: -20px / left: -20px), so a slide fitted to the
	// full viewport width leaves the auto side-margins under 20px and the
	// scroll container clips the vertical strip away entirely. Twice the
	// thickness horizontally, because `margin: auto` splits the slack evenly
	// and only the left half is the gutter the strip needs.
	const gutter = props.showRulers ? RULER_THICKNESS : 0;
	const availW = Math.max(el.clientWidth - 16 - gutter * 2, 0);
	const availH = Math.max(el.clientHeight - 32 - gutter, 0);
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

// Re-fit when the authored slide size changes (e.g. switching decks), and when
// the rulers appear/disappear, since they change the space available to fit in.
watch(() => [props.canvasSize.width, props.canvasSize.height, props.showRulers], recomputeFit);
</script>

<template>
	<div ref="viewportRef" class="pptx-vue-canvas-viewport" data-pptx-viewport>
		<div
			class="pptx-vue-canvas-wrapper"
			:style="wrapperStyle"
			role="region"
			aria-roledescription="slide"
			:aria-label="t('pptx.canvas.slide')"
		>
			<RulerStrips
				v-if="showRulers"
				:canvas-size="canvasSize"
				:scale="scale"
				:unit="rulerUnit"
				:selected-bounds="rulerSelectedBounds"
				:draggable="canDragGuides"
				@create-guide="(axis, position) => emit('createGuide', axis, position)"
			/>
			<SlideStage
				:slide="slide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				:template-elements="templateElements"
				:edit-template-mode="editTemplateMode"
				:inline-editing-element-id="inlineEditingElementId"
				interactive
			>
				<slot />
			</SlideStage>
		</div>
	</div>
</template>
