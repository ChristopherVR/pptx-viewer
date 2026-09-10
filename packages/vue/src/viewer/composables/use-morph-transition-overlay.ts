import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	buildMorphScopedCss,
	buildMorphTransitionPlan,
	MORPH_CROSSFADE_GROUP_STYLE,
	MORPH_CROSSFADE_HALF_BLEND_MODE,
	morphOptionToMode,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

/**
 * Morph-specific reactive state for `PresentationTransitionOverlay.vue`,
 * split out to keep that file under the project's per-file LOC budget.
 *
 * Morph is not a whole-slide wipe: individual shapes travel from where they
 * sat on the outgoing slide to where they sit on the incoming one, so when
 * the transition is `morph` the overlay's two stacked layers are re-purposed
 * - the incoming layer plays per-element keyframes (scoped by
 * `data-pptx-morph-incoming`), and the outgoing layer paints a moving copy of
 * the outgoing slide, each shape gliding onto its counterpart (dissolving
 * into it when its appearance changed) or fading out in place when it has
 * none.
 *
 * Inputs are getters (not raw values) so the returned `computed`s stay
 * reactive to the host component's own props.
 */
export function useMorphTransitionOverlay(options: {
	transition: () => PptxSlideTransition | undefined;
	outgoingSlide: () => PptxSlide | undefined;
	incomingSlide: () => PptxSlide | undefined;
	durationMs: () => number;
}) {
	const morphPlan = computed(() => {
		const transition = options.transition();
		return transition?.type === 'morph'
			? buildMorphTransitionPlan(
					options.outgoingSlide(),
					options.incomingSlide(),
					options.durationMs(),
					morphOptionToMode(transition.morphOption),
				)
			: undefined;
	});

	/** The outgoing slide's shapes, rendered as the morph's departing layer. */
	const morphOutgoingSlide = computed<PptxSlide | undefined>(() => {
		const plan = morphPlan.value;
		const outgoingSlide = options.outgoingSlide();
		if (!plan || !outgoingSlide) {
			return undefined;
		}
		return { ...outgoingSlide, elements: plan.outgoingElements };
	});

	/**
	 * The arriving shapes a ghost above them would otherwise hide for the whole
	 * morph, painted in their own layer over the departing one (issue #146).
	 * Their copy on the incoming layer is held invisible by the plan, so the
	 * two never composite with each other.
	 */
	const morphLiftedSlide = computed<PptxSlide | undefined>(() => {
		const plan = morphPlan.value;
		const incomingSlide = options.incomingSlide();
		if (!plan || !incomingSlide || plan.overlayIncomingElements.length === 0) {
			return undefined;
		}
		return { ...incomingSlide, elements: plan.overlayIncomingElements };
	});

	/** Both halves of a grouped pair blend additively, and only with each other. */
	const crossfadeHalfStyle: CSSProperties = { mixBlendMode: MORPH_CROSSFADE_HALF_BLEND_MODE };

	/**
	 * The pairs whose two halves the overlay paints itself, as one isolated
	 * group each so they can be SUMMED rather than stacked.
	 *
	 * Two source-over fades leave the ink the halves share dipped toward the
	 * backdrop (0.75 of full strength at the midpoint), which bites chunks out
	 * of glyphs crossing during a text dissolve; PowerPoint's own render holds
	 * the two coefficients at a sum of 1.0 throughout (issue #161).
	 */
	const morphCrossfadeGroups = computed(() => {
		const plan = morphPlan.value;
		const outgoing = options.outgoingSlide();
		const incoming = options.incomingSlide();
		if (!plan || !outgoing || !incoming) {
			return [];
		}
		return plan.crossfadeGroups.map((group, index) => ({
			key: group.incoming.id,
			// `isolation` makes the group a stacking context, so it needs its own
			// z-index to stay above the ghosts its halves used to sit among.
			style: { ...MORPH_CROSSFADE_GROUP_STYLE, zIndex: 4 + index } as CSSProperties,
			// The dissolve rides these WRAPPERS, not the elements: a pair
			// dissolving in place never moves, and an animation on the small
			// element box gives it a compositing layer whose raster snaps to
			// whole device pixels, painting the wording a fraction of a pixel
			// off the live stage (issue #161).
			outgoingStyle: { ...crossfadeHalfStyle, animation: group.outgoingAnimation } as CSSProperties,
			incomingStyle: { ...crossfadeHalfStyle, animation: group.incomingAnimation } as CSSProperties,
			outgoingSlide: { ...outgoing, elements: [group.outgoing] },
			incomingSlide: { ...incoming, elements: [group.incoming] },
		}));
	});

	const morphCss = computed(() => {
		const plan = morphPlan.value;
		if (!plan) {
			return '';
		}
		return [
			buildMorphScopedCss(plan, 'data-pptx-morph-incoming', 'incoming'),
			buildMorphScopedCss(plan, 'data-pptx-morph-outgoing', 'outgoing'),
			buildMorphScopedCss(plan, 'data-pptx-morph-lifted', 'lifted'),
		].join('\n');
	});

	return { morphPlan, morphOutgoingSlide, morphLiftedSlide, morphCrossfadeGroups, morphCss };
}

/** One entry of {@link useMorphTransitionOverlay}'s `morphCrossfadeGroups`. */
export type MorphCrossfadeGroupView = ReturnType<
	typeof useMorphTransitionOverlay
>['morphCrossfadeGroups']['value'][number];
