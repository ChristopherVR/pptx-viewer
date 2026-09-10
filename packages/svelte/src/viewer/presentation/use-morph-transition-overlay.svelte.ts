import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	buildMorphScopedCss,
	buildMorphTransitionPlan,
	MORPH_CROSSFADE_GROUP_CSS_TEXT,
	MORPH_CROSSFADE_HALF_BLEND_MODE,
	morphOptionToMode,
} from 'pptx-viewer-shared';

/**
 * Morph-specific reactive state for `PresentationTransitionOverlay.svelte`,
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
 * Inputs are getters (not raw values) so the `$derived`s stay reactive to the
 * host component's own props; call this once, at component init, per the
 * Svelte 5 rules-of-runes.
 */
export function useMorphTransitionOverlay(options: {
	transition: () => PptxSlideTransition | undefined;
	outgoingSlide: () => PptxSlide | undefined;
	incomingSlide: () => PptxSlide | undefined;
	durationMs: () => number;
}) {
	const morphPlan = $derived(
		options.transition()?.type === 'morph'
			? buildMorphTransitionPlan(
					options.outgoingSlide(),
					options.incomingSlide(),
					options.durationMs(),
					morphOptionToMode((options.transition() as PptxSlideTransition).morphOption),
				)
			: undefined,
	);

	/** The outgoing slide's shapes, rendered as the morph's departing layer. */
	const morphOutgoingSlide = $derived(
		morphPlan && options.outgoingSlide()
			? { ...(options.outgoingSlide() as PptxSlide), elements: morphPlan.outgoingElements }
			: undefined,
	);

	/**
	 * The arriving shapes a ghost above them would otherwise hide for the whole
	 * morph, painted in their own layer over the departing one (issue #146).
	 * Their copy on the incoming layer is held invisible by the plan, so the
	 * two never composite with each other.
	 */
	const morphLiftedSlide = $derived(
		morphPlan && options.incomingSlide() && morphPlan.overlayIncomingElements.length > 0
			? { ...(options.incomingSlide() as PptxSlide), elements: morphPlan.overlayIncomingElements }
			: undefined,
	);

	/** One half of a grouped pair: blends additively, and carries the dissolve. */
	function halfStyle(animation: string | undefined): string {
		return `mix-blend-mode: ${MORPH_CROSSFADE_HALF_BLEND_MODE};${
			animation === undefined ? '' : ` animation: ${animation};`
		}`;
	}

	/**
	 * The pairs the overlay paints BOTH halves of, each as one isolated group so
	 * the halves are summed rather than stacked: two source-over fades leave the
	 * ink they share at 0.75 of full strength mid-transition, biting chunks out
	 * of glyphs that cross during a text dissolve, where PowerPoint's own blend
	 * keeps the two coefficients summing to 1.0 (issue #161).
	 */
	const morphCrossfadeGroups = $derived.by(() => {
		const outgoingSlide = options.outgoingSlide();
		const incomingSlide = options.incomingSlide();
		if (!morphPlan || !outgoingSlide || !incomingSlide) {
			return [];
		}
		return morphPlan.crossfadeGroups.map((group, index) => ({
			key: group.incoming.id,
			// `isolation` makes the group a stacking context, so it carries its
			// own z-index to stay above the ghosts its halves came from.
			style: `${MORPH_CROSSFADE_GROUP_CSS_TEXT} z-index: ${4 + index};`,
			// The dissolve rides these WRAPPERS, not the elements: a pair
			// dissolving in place never moves, and an animation on the small
			// element box gives it a compositing layer whose raster snaps to
			// whole device pixels, painting the wording a fraction of a pixel
			// off the live stage (issue #161).
			outgoingStyle: halfStyle(group.outgoingAnimation),
			incomingStyle: halfStyle(group.incomingAnimation),
			outgoing: { ...outgoingSlide, elements: [group.outgoing] },
			incoming: { ...incomingSlide, elements: [group.incoming] },
		}));
	});

	const morphCss = $derived(
		morphPlan
			? [
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-incoming', 'incoming'),
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-outgoing', 'outgoing'),
					buildMorphScopedCss(morphPlan, 'data-pptx-morph-lifted', 'lifted'),
				].join('\n')
			: '',
	);

	return {
		get morphPlan() {
			return morphPlan;
		},
		get morphOutgoingSlide() {
			return morphOutgoingSlide;
		},
		get morphLiftedSlide() {
			return morphLiftedSlide;
		},
		get morphCrossfadeGroups() {
			return morphCrossfadeGroups;
		},
		get morphCss() {
			return morphCss;
		},
	};
}

/** One entry of {@link useMorphTransitionOverlay}'s `morphCrossfadeGroups`. */
export type MorphCrossfadeGroupView = ReturnType<
	typeof useMorphTransitionOverlay
>['morphCrossfadeGroups'][number];
