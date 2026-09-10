<script setup lang="ts">
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import type { FragmentedTransitionDescriptor } from 'pptx-viewer-shared';
import { applySlideTransitionSound, getFragmentedTransitionDescriptor } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';

import { playAnimationSound, stopAnimationSound } from '../composables/animation-sound';
import {
	resolveSlideTransition,
	resolveTransitionDurationMs,
	SLIDE_TRANSITION_KEYFRAMES_CSS,
} from '../composables/slide-transition-css';
import { useMorphTransitionOverlay } from '../composables/use-morph-transition-overlay';
import type { CanvasSize } from '../types';
import FragmentedTransitionLayer from './FragmentedTransitionLayer.vue';
import MorphExtraLayers from './MorphExtraLayers.vue';
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

/**
 * Multi-fragment descriptor for the seven cinematic transitions measured as
 * many independent fragments/particles/panels (vortex, honeycomb, glitter,
 * shred, fracture, curtains, airplane) - see `slide-transition-fragments.ts`
 * in `pptx-viewer-shared`. `undefined` for every other type (morph included:
 * none of the seven fragmented presets is morph), in which case `animations`
 * above (the single-layer resolver) drives both layers exactly as before.
 */
const fragmented = computed<FragmentedTransitionDescriptor | undefined>(() =>
	props.transition
		? getFragmentedTransitionDescriptor(
				props.transition.type,
				durationMs.value,
				props.transition.direction,
				props.transition.spokes,
				props.transition.pattern,
			)
		: undefined,
);

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
 * or fading out in place when it has none. See `use-morph-transition-overlay.ts`.
 */
const { morphPlan, morphOutgoingSlide, morphLiftedSlide, morphCrossfadeGroups, morphCss } =
	useMorphTransitionOverlay({
		transition: () => props.transition,
		outgoingSlide: () => props.outgoingSlide,
		incomingSlide: () => props.incomingSlide,
		durationMs: () => durationMs.value,
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

const liftedLayerStyle = computed<CSSProperties>(() => ({ zIndex: 3 }));

const incomingLayerStyle = computed<CSSProperties>(() => ({
	zIndex: morphPlan.value ? 1 : incomingZIndex.value,
	animation: morphPlan.value
		? undefined
		: animations.value.incoming !== 'none'
			? animations.value.incoming
			: undefined,
}));

// ---------------------------------------------------------------------------
// Sound (`p:sndAc/p:stSnd`/`p:endSnd`)
// ---------------------------------------------------------------------------

/**
 * Play or stop this transition's sound action the instant it starts.
 *
 * `transition.soundPath` is a raw in-archive path; `mediaDataUrls` is the
 * same Blob-URL cache the load pipeline pre-populates for it (via
 * `collectAnimationSoundPaths`, extended to also collect a slide transition's
 * own sound alongside per-effect animation sounds). Reuses the per-effect
 * sound singleton (`animation-sound.ts`) so a transition sound and an
 * animation sound cannot talk over each other, matching PowerPoint's "one
 * sound plays at a time" behaviour.
 */
watch(
	() => props.transition,
	(transition) => {
		applySlideTransitionSound(transition, (soundPath) => props.mediaDataUrls.get(soundPath), {
			play: playAnimationSound,
			stop: stopAnimationSound,
		});
	},
	{ immediate: true },
);

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

// NOT stopped here: a "Loop Until Next Sound" transition sound must keep
// playing across the (much longer) static period between this overlay
// tearing down and the NEXT transition's own sound action, exactly as
// PowerPoint does. `PresentationMode.vue` stops it on leaving the show.
onBeforeUnmount(clearTimer);
</script>

<template>
	<div class="pptx-vue-transition-overlay" data-pptx-transition-overlay>
		<!-- Inject the transition @keyframes once for this overlay. -->
		<component :is="'style'">{{ SLIDE_TRANSITION_KEYFRAMES_CSS }}</component>
		<component :is="'style'" v-if="morphPlan">{{ morphCss }}</component>

		<!-- Outgoing (old) slide snapshot. During a morph this carries only the
		     shapes with no incoming counterpart, so the ones that persist stay
		     visible on the incoming layer while they travel - and it must stay
		     BACKGROUND-FREE, or the departing layer's opaque slide fill covers the
		     morph underneath it for the whole transition. -->
		<div
			class="pptx-vue-transition-layer"
			data-pptx-transition-layer="outgoing"
			:data-pptx-morph-outgoing="morphPlan ? 'true' : undefined"
			:data-pptx-transition-fragments="
				!morphPlan && fragmented?.outgoing ? fragmented.outgoing.keyframesName : undefined
			"
			:style="outgoingLayerStyle"
		>
			<FragmentedTransitionLayer
				v-if="!morphPlan && fragmented?.outgoing"
				:layer="fragmented.outgoing"
				:slide="outgoingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				layer-name="outgoing"
			/>
			<SlideStage
				v-else
				:slide="morphPlan ? morphOutgoingSlide : outgoingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				:preserve-element-ids="Boolean(morphPlan)"
				:transparent-background="Boolean(morphPlan)"
			/>
		</div>

		<!-- Incoming (new) slide. -->
		<div
			class="pptx-vue-transition-layer"
			data-pptx-transition-layer="incoming"
			:data-pptx-morph-incoming="morphPlan ? 'true' : undefined"
			:data-pptx-transition-fragments="
				!morphPlan && fragmented?.incoming ? fragmented.incoming.keyframesName : undefined
			"
			:style="incomingLayerStyle"
		>
			<FragmentedTransitionLayer
				v-if="!morphPlan && fragmented?.incoming"
				:layer="fragmented.incoming"
				:slide="incomingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				layer-name="incoming"
			/>
			<SlideStage
				v-else
				:slide="incomingSlide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
				:preserve-element-ids="Boolean(morphPlan)"
			/>
		</div>

		<!-- The two morph-only extra layers (arriving-above-departing "lifted"
		     shapes, and same-pair crossfade groups) - see `MorphExtraLayers.vue`. -->
		<MorphExtraLayers
			:lifted-slide="morphLiftedSlide"
			:lifted-layer-style="liftedLayerStyle"
			:crossfade-groups="morphCrossfadeGroups"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:scale="scale"
		/>
	</div>
</template>

<style scoped>
.pptx-vue-transition-overlay {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
}

/*
 * The layer must FILL the overlay, not shrink-wrap its child: `SlideStage`
 * scales with a `transform`, which never changes its laid-out box, so an
 * auto-sized absolute layer would measure the deck's native size instead of
 * the display size and crop the transition to that corner on a larger show
 * surface. `inset: 0` pins it to the overlay (the frame's own scaled
 * footprint), landing the clip exactly on the slide edge.
 */
.pptx-vue-transition-layer {
	position: absolute;
	inset: 0;
	overflow: hidden;
	will-change: transform, opacity, clip-path, filter;
}
</style>
