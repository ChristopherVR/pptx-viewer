import { computed } from '@angular/core';
import type { Signal } from '@angular/core';
import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { CanvasSize, FragmentedTransitionDescriptor } from '../internal/shared';
import {
	buildMorphTransitionPlan,
	getFragmentedTransitionDescriptor,
	morphOptionToMode,
} from '../internal/shared';
import type { StyleMap } from './element-style';
import type { MorphCrossfadeGroupSlides } from './presentation-transition-overlay-morph';
import {
	classicIncomingLayerSlide,
	morphCrossfadeGroupSlides,
	morphLiftedSlide,
	withTemplateElements,
} from './presentation-transition-overlay-morph';
import {
	getSlideTransitionAnimations,
	resolveOverlayDurationMs,
	transitionSlideBoxSize,
} from './transition-helpers';
import type { SlideTransitionAnimations } from './transition-helpers';

/**
 * All of `PresentationTransitionOverlayComponent`'s derived (`computed()`)
 * state, split out to keep that file under the project's per-file LOC
 * budget. A plain factory rather than a class: Angular's `computed()` does
 * not need an injection context (unlike `inject()`/`effect()`), so this can
 * be called once from the component's constructor and its signals re-exposed
 * as thin `protected readonly` properties for the template to bind against.
 */
export function createTransitionOverlayState(inputs: {
	outgoingSlide: Signal<PptxSlide>;
	incomingSlide: Signal<PptxSlide | undefined>;
	canvasSize: Signal<CanvasSize>;
	transition: Signal<PptxSlideTransition>;
	templateElements: Signal<readonly PptxElement[]>;
	durationMs: Signal<number | undefined>;
	zoom: Signal<number>;
}) {
	/** Effective transition duration (ms), floored/defaulted. */
	const resolvedDurationMs = computed<number>(() =>
		resolveOverlayDurationMs(inputs.durationMs(), inputs.transition()),
	);

	/** Resolved CSS animation descriptors for the outgoing/incoming layers. */
	const animations = computed<SlideTransitionAnimations>(() => {
		const tr = inputs.transition();
		return getSlideTransitionAnimations(
			tr.type,
			resolvedDurationMs(),
			tr.direction,
			tr.orient,
			tr.spokes,
			tr.pattern,
		);
	});

	/**
	 * Multi-fragment descriptor for the seven cinematic transitions measured
	 * (via COM `CreateVideo`) as many independent fragments/particles/panels
	 * rather than one animated layer (vortex, honeycomb, glitter, shred,
	 * fracture, curtains, airplane). `undefined` for every other type,
	 * including morph, in which case `animations` above (the single-layer
	 * resolver) keeps driving both layers exactly as before. Depends only on
	 * the transition input and its resolved duration, matching `animations`,
	 * so it does not recompute on unrelated store writes.
	 */
	const fragmented = computed<FragmentedTransitionDescriptor | undefined>(() => {
		const tr = inputs.transition();
		return getFragmentedTransitionDescriptor(
			tr.type,
			resolvedDurationMs(),
			tr.direction,
			tr.spokes,
			tr.pattern,
		);
	});

	/** This overlay's fragmented OUTGOING layer, when the transition has one. */
	const fragmentedOutgoing = computed(() => fragmented()?.outgoing);

	/** This overlay's fragmented INCOMING layer, when the transition has one. */
	const fragmentedIncoming = computed(() => fragmented()?.incoming);

	/**
	 * Z-index for the fragmented outgoing layer: identical to the non-fragmented
	 * `layerStyle` rule it replaces (fragmented and morph never coexist, so the
	 * plan branch there never applies here).
	 */
	const fragmentedOutgoingZIndex = computed<number>(() => (animations().outgoingOnTop ? 40 : 20));

	/** Z-index for the fragmented incoming layer: matches `incomingLayerStyle`. */
	const fragmentedIncomingZIndex = computed<number>(() => (animations().outgoingOnTop ? 30 : 25));

	/**
	 * The arriving slide (+ its template), for the fragmented incoming layer.
	 * Unlike `incomingLayerSlide` this does not gate on the single-layer
	 * `animations().incoming` value: presence of `fragmentedIncoming` already
	 * decides whether this layer renders.
	 */
	const incomingFragmentSlide = computed<PptxSlide | undefined>(() => {
		const incoming = inputs.incomingSlide();
		return incoming ? withTemplateElements(incoming, inputs.templateElements()) : undefined;
	});

	/**
	 * Active Morph plan, or `undefined` for every other transition.
	 *
	 * Morph travels individual shapes between the two slides rather than wiping
	 * the surface, so it changes what this overlay paints: a per-shape copy of
	 * the outgoing slide, each one gliding onto its counterpart (dissolving into
	 * it when its appearance changed) or fading out in place when it has none.
	 * The incoming halves are animated on the live stage by the component's own
	 * document-level morph-style effect.
	 */
	const morphPlan = computed(() =>
		inputs.transition().type === 'morph'
			? buildMorphTransitionPlan(
					inputs.outgoingSlide(),
					inputs.incomingSlide(),
					resolvedDurationMs(),
					morphOptionToMode(inputs.transition().morphOption),
				)
			: undefined,
	);

	/**
	 * Whether this overlay is playing a morph.
	 *
	 * A morph layer paints only the departing slide's paired shapes over the live
	 * incoming stage, so its stage background must be dropped
	 * (`transparentBackground`). Every other transition animates a whole slide
	 * surface out and keeps its own background.
	 */
	const isMorph = computed<boolean>(() => morphPlan() !== undefined);

	/** The slide rendered in the animated layer (outgoing + its template). */
	const layerSlide = computed<PptxSlide>(() => {
		const slide = inputs.outgoingSlide();
		const plan = morphPlan();
		if (plan) {
			return { ...slide, elements: [...plan.outgoingElements] };
		}
		return withTemplateElements(slide, inputs.templateElements());
	});

	/**
	 * The arriving shapes the morph has to paint over its own ghosts, or
	 * `undefined` when there are none (issue #146). They sit on the live stage
	 * below this overlay, where the departing layer would hide them for the whole
	 * transition; the plan holds that copy invisible and hands them here instead.
	 */
	const liftedSlide = computed<PptxSlide | undefined>(() =>
		morphLiftedSlide(morphPlan(), inputs.incomingSlide()),
	);

	/**
	 * The cross-dissolving pairs this overlay paints both halves of, each in its
	 * own isolated group so the halves are summed rather than stacked.
	 */
	const crossfadeGroups = computed<MorphCrossfadeGroupSlides[]>(() =>
		morphCrossfadeGroupSlides(morphPlan(), inputs.outgoingSlide(), inputs.incomingSlide()),
	);

	/** Layer container style: animation + stacking relative to the stage. */
	const layerStyle = computed<StyleMap>(() => {
		const anims = animations();
		const plan = morphPlan();
		const style: StyleMap = {
			'z-index': plan ? '40' : anims.outgoingOnTop ? '40' : '20',
		};
		// A layer-wide animation would drag every shape as one block and cancel
		// the morph, so during a morph the layer itself stays still.
		if (!plan && anims.outgoing !== 'none') {
			style['animation'] = anims.outgoing;
		}
		return style;
	});

	/**
	 * The arriving slide rendered ABOVE the outgoing layer for a classic
	 * transition, carrying the incoming animation (wipe/cover/fade/push), or
	 * `undefined` for morphs and the uncover family (which reveal the live
	 * stage instead).
	 */
	const incomingLayerSlide = computed<PptxSlide | undefined>(() =>
		classicIncomingLayerSlide(
			isMorph(),
			animations().incoming,
			inputs.incomingSlide(),
			inputs.templateElements(),
		),
	);

	/** Style for that arriving layer: the incoming animation + its stacking. */
	const incomingLayerStyle = computed<StyleMap>(() => ({
		'z-index': animations().outgoingOnTop ? '30' : '25',
		animation: animations().incoming,
	}));

	/**
	 * Slide box sized to the ZOOMED slide footprint, matching the stage's own
	 * `pptx-slide-canvas`. The inner canvas renders at the same `zoom` with
	 * `autoFit` off, so the outgoing slide is pixel-for-pixel the size of the
	 * incoming one for the whole animation.
	 */
	const slideBoxStyle = computed<StyleMap>(() => {
		const box = transitionSlideBoxSize(inputs.canvasSize(), inputs.zoom());
		return {
			width: `${box.width}px`,
			height: `${box.height}px`,
			'transform-origin': 'center',
		};
	});

	return {
		resolvedDurationMs,
		animations,
		fragmented,
		fragmentedOutgoing,
		fragmentedIncoming,
		fragmentedOutgoingZIndex,
		fragmentedIncomingZIndex,
		incomingFragmentSlide,
		morphPlan,
		isMorph,
		layerSlide,
		liftedSlide,
		crossfadeGroups,
		layerStyle,
		incomingLayerSlide,
		incomingLayerStyle,
		slideBoxStyle,
	};
}
