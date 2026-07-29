<script setup lang="ts">
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	buildMorphScopedCss,
	buildMorphTransitionPlan,
	morphOptionToMode,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
	resolveSlideTransition,
	resolveTransitionDurationMs,
	SLIDE_TRANSITION_KEYFRAMES_CSS,
} from '../composables/slide-transition-css';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * PresentationTransitionOverlay - animates a slide change in presentation mode.
 *
 * It stacks two {@link SlideStage} layers, both scaled-to-fit identically to the
 * underlying presentation frame:
 *   - the **outgoing** (old) slide as a snapshot layer, and
 *   - the **incoming** (new) slide.
 *
 * The active slide's {@link PptxSlideTransition} is mapped to CSS `animation`
 * shorthands (via {@link resolveSlideTransition}); each layer's `z-index` is set
 * from `outgoingOnTop`. When the configured duration elapses the overlay emits
 * `done`, at which point the host should drop the overlay and leave the static
 * incoming slide rendered by its main stage.
 *
 * `PresentationMode` is expected to mount this **only while a transition is
 * playing** (between the outgoing and incoming slides), render nothing of its
 * own animated stage during that window, and remove it on `@done`.
 */
const props = withDefaults(
	defineProps<{
		/** The outgoing (previous) slide rendered in the exit layer. */
		outgoingSlide: PptxSlide | undefined;
		/** The incoming (new) slide rendered in the entrance layer. */
		incomingSlide: PptxSlide | undefined;
		/** Slide surface dimensions (px). */
		canvasSize: CanvasSize;
		/** Resolved media data URLs, threaded to each {@link SlideStage}. */
		mediaDataUrls: Map<string, string>;
		/** Fit-to-viewport scale (same value the host applies to its main stage). */
		scale?: number;
		/** The transition definition from the incoming slide. */
		transition: PptxSlideTransition | undefined;
	}>(),
	{ scale: 1 },
);

const emit = defineEmits<{
	(e: 'done'): void;
}>();

// ---------------------------------------------------------------------------
// Resolved animation pieces
// ---------------------------------------------------------------------------

const animations = computed(() => resolveSlideTransition(props.transition));

/** Effective duration (ms); `0` for instant (none/cut). */
const durationMs = computed(() => resolveTransitionDurationMs(props.transition));

// ---------------------------------------------------------------------------
// Morph
// ---------------------------------------------------------------------------

/**
 * Morph is not a whole-slide wipe: individual shapes travel from where they sat
 * on the outgoing slide to where they sit on the incoming one. So when the
 * transition is `morph` the two stacked layers are re-purposed - the incoming
 * layer plays per-element keyframes (scoped by `data-pptx-morph-incoming`), and
 * the outgoing layer paints a moving copy of the outgoing slide, each shape
 * gliding onto its counterpart (dissolving into it when its appearance changed)
 * or fading out in place when it has none.
 */
const morphPlan = computed(() =>
	props.transition?.type === 'morph'
		? buildMorphTransitionPlan(
				props.outgoingSlide,
				props.incomingSlide,
				durationMs.value,
				morphOptionToMode(props.transition.morphOption),
			)
		: undefined,
);

/** The outgoing slide's shapes, rendered as the morph's departing layer. */
const morphOutgoingSlide = computed<PptxSlide | undefined>(() => {
	const plan = morphPlan.value;
	if (!plan || !props.outgoingSlide) {
		return undefined;
	}
	return { ...props.outgoingSlide, elements: plan.outgoingElements };
});

const morphCss = computed(() => {
	const plan = morphPlan.value;
	if (!plan) {
		return '';
	}
	return [
		buildMorphScopedCss(plan, 'data-pptx-morph-incoming', 'incoming'),
		buildMorphScopedCss(plan, 'data-pptx-morph-outgoing', 'outgoing'),
	].join('\n');
});

const outgoingZIndex = computed(() => (animations.value.outgoingOnTop ? 2 : 1));
const incomingZIndex = computed(() => (animations.value.outgoingOnTop ? 1 : 2));

const outgoingLayerStyle = computed<CSSProperties>(() => ({
	zIndex: morphPlan.value ? 2 : outgoingZIndex.value,
	// Morph animates each shape individually; a layer-wide animation on top of
	// that would drag the whole slide and cancel the effect.
	animation: morphPlan.value
		? undefined
		: animations.value.outgoing !== 'none'
			? animations.value.outgoing
			: undefined,
}));

const incomingLayerStyle = computed<CSSProperties>(() => ({
	zIndex: morphPlan.value ? 1 : incomingZIndex.value,
	animation: morphPlan.value
		? undefined
		: animations.value.incoming !== 'none'
			? animations.value.incoming
			: undefined,
}));

// ---------------------------------------------------------------------------
// Completion timer
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer(): void {
	if (timer !== null) {
		clearTimeout(timer);
		timer = null;
	}
}

onMounted(() => {
	// A small buffer past the animation duration ensures the CSS `forwards`
	// fill has settled before the host swaps to the static slide.
	const wait = Math.max(0, durationMs.value) + 50;
	timer = setTimeout(() => {
		timer = null;
		emit('done');
	}, wait);
});

onBeforeUnmount(clearTimer);
</script>

<template>
	<div class="pptx-vue-transition-overlay" data-pptx-transition-overlay>
		<!-- Inject the transition @keyframes once for this overlay. -->
		<component :is="'style'">{{ SLIDE_TRANSITION_KEYFRAMES_CSS }}</component>
		<component :is="'style'" v-if="morphPlan">{{ morphCss }}</component>

		<!-- Outgoing (old) slide snapshot. During a morph this carries only the
		     shapes with no incoming counterpart, so the ones that persist stay
		     visible on the incoming layer while they travel. -->
		<div
			class="pptx-vue-transition-layer"
			data-pptx-transition-layer="outgoing"
			:data-pptx-morph-outgoing="morphPlan ? 'true' : undefined"
			:style="outgoingLayerStyle"
		>
			<SlideStage
				:slide="morphPlan ? morphOutgoingSlide : outgoingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				:preserve-element-ids="Boolean(morphPlan)"
			/>
		</div>

		<!-- Incoming (new) slide. -->
		<div
			class="pptx-vue-transition-layer"
			data-pptx-transition-layer="incoming"
			:data-pptx-morph-incoming="morphPlan ? 'true' : undefined"
			:style="incomingLayerStyle"
		>
			<SlideStage
				:slide="incomingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				:preserve-element-ids="Boolean(morphPlan)"
			/>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-transition-overlay {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
}

.pptx-vue-transition-layer {
	position: absolute;
	top: 0;
	left: 0;
	overflow: hidden;
	will-change: transform, opacity, clip-path, filter;
}
</style>
