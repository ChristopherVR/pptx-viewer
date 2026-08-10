/**
 * Turn two slides into everything a binding needs to actually PLAY a morph
 * transition.
 *
 * `morph-animation` already produces the CSS, but as one flat list keyed by a
 * mix of outgoing- and incoming-slide element ids, which is not directly
 * usable by a view layer. This module partitions it the way a renderer
 * consumes it and states the contract the bindings share, so React / Vue /
 * Angular / Svelte / Vanilla do not each re-derive it.
 *
 * ## How a morph is composed
 *
 * PowerPoint's Morph is a FLIP animation, and the generated keyframes follow
 * that model:
 *
 * - A **matched pair** animates on the INCOMING element. It is rendered at its
 *   final geometry and the keyframes start it at the outgoing element's
 *   offset/scale/rotation, so it appears to glide into place. Hence
 *   {@link MorphTransitionPlan.incomingAnimations} is keyed by incoming id.
 *   When the pair's APPEARANCE also changed (fill, outline, picture, text) the
 *   incoming half fades in over a ghost of the outgoing half travelling the
 *   same path, so the two dissolve into each other instead of cutting.
 * - An element only on the **outgoing** slide fades out in place. It is not in
 *   the incoming slide at all, so the binding has to keep painting it for the
 *   duration: {@link MorphTransitionPlan.outgoingElements} is exactly that set,
 *   with its animations in {@link MorphTransitionPlan.outgoingAnimations}.
 * - An element only on the **incoming** slide fades in; also keyed by incoming
 *   id in `incomingAnimations`.
 *
 * A binding therefore: injects {@link MorphTransitionPlan.keyframesCss} once,
 * renders `outgoingElements` in an overlay above the slide, applies
 * `outgoingAnimations` to them and `incomingAnimations` to the real slide's
 * elements, then tears the overlay down after `durationMs`.
 *
 * @module render/morph-plan
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import {
	generateFullMorphTransition,
	morphPairIncomingFadesIn,
	morphPairNeedsCrossfade,
	resolveMorphGhostIds,
} from './morph-animation';
import { flattenMorphElements } from './morph-flatten';
import { matchMorphElementsFull } from './morph-matching';
import { resolveMorphOverlayArrivals } from './morph-overlay-order';
import type { MorphMode } from './morph-types';

/**
 * Keyframes for an incoming shape whose dissolve has been lifted into the
 * overlay: the copy left on the live stage holds at nothing for the whole
 * morph, so the two copies never composite with each other.
 */
const LIFTED_HIDDEN_NAME = 'pptx-morph-lifted-hidden';
const LIFTED_HIDDEN_KEYFRAMES = `
@keyframes ${LIFTED_HIDDEN_NAME} {
\tfrom {
\t\topacity: 0;
\t}
\tto {
\t\topacity: 0;
\t}
}`;

/** Everything needed to play one morph transition. */
export interface MorphTransitionPlan {
	/** All `@keyframes` blocks, to inject as a single stylesheet. */
	keyframesCss: string;
	/** Incoming-slide element id -> CSS `animation` shorthand. */
	incomingAnimations: Map<string, string>;
	/** Outgoing-slide element id -> CSS `animation` shorthand. */
	outgoingAnimations: Map<string, string>;
	/**
	 * Incoming-slide element id -> CSS `animation` shorthand for the `<img>`
	 * INSIDE that element, never for the element's own container.
	 *
	 * A picture's source crop (`a:srcRect`, which is what PowerPoint's "Scale
	 * Height"/"Scale Width" writes) is painted by transforming the img within
	 * its frame, and the frame itself is usually identical on both slides - so
	 * this is a separate channel rather than another entry in
	 * {@link MorphTransitionPlan.incomingAnimations}, which would collide on the
	 * same element id. {@link buildMorphScopedCss} emits it as a descendant
	 * rule; a binding that applies animations as inline props instead must
	 * target the img itself (issue #148).
	 */
	incomingImageAnimations: Map<string, string>;
	/** Outgoing (ghost) counterpart of {@link MorphTransitionPlan.incomingImageAnimations}. */
	outgoingImageAnimations: Map<string, string>;
	/**
	 * Incoming-slide element id -> CSS `animation` shorthand for the copy the
	 * overlay paints, above every ghost.
	 *
	 * These are the arriving shapes a ghost would otherwise hide for the whole
	 * transition (see {@link MorphTransitionPlan.overlayIncomingElements}). Their
	 * entry in {@link MorphTransitionPlan.incomingAnimations} has been replaced
	 * by one that holds them invisible, so the stage copy stays out of the way
	 * and only this one is seen.
	 */
	overlayIncomingAnimations: Map<string, string>;
	/**
	 * The incoming-slide elements to paint in the overlay ON TOP of
	 * {@link MorphTransitionPlan.outgoingElements}, in document order.
	 *
	 * The overlay is one flat layer above the live stage, which is only faithful
	 * while every ghost really does belong on top of everything the stage draws.
	 * A shape arriving INSIDE a persisting one does not: the wheel deck's centre
	 * disc is unchanged between slides, so its ghost is opaque for the whole
	 * morph, and the title and body dissolving in within it were invisible until
	 * the overlay came down (issue #146). Painting those here restores the order
	 * PowerPoint composites in.
	 *
	 * Usually empty. A binding renders these with the INCOMING slide as their
	 * context, applying {@link MorphTransitionPlan.overlayIncomingAnimations}.
	 */
	overlayIncomingElements: PptxElement[];
	/**
	 * The outgoing slide's elements, in document order, for the binding to
	 * render in its transition overlay for the duration of the morph. Most carry
	 * an entry in {@link MorphTransitionPlan.outgoingAnimations}: they either
	 * fade out in place (no counterpart) or glide onto a counterpart, dissolving
	 * into it when the appearance changed.
	 *
	 * A ghost standing in for an INERT pair deliberately has no entry there and
	 * is painted statically. Its keyframes would run from itself to itself, and
	 * a running animation would put it on its own compositing layer, whose
	 * raster the browser snaps to whole device pixels - visibly shifting a shape
	 * that is not supposed to move at all (issue #161).
	 *
	 * This is a SUBSET of the outgoing slide: a shape the live stage already
	 * draws identically is left out, because the overlay is opaque above it and
	 * would hide the incoming slide's own arrivals. See `resolveMorphGhostIds`.
	 */
	outgoingElements: PptxElement[];
	/** Animation duration in ms, echoed for convenience. */
	durationMs: number;
}

/** Map a parsed `<p159:morph @option>` onto the engine's granularity mode. */
export function morphOptionToMode(option: string | undefined): MorphMode {
	if (option === 'byWord') {
		return 'word';
	}
	if (option === 'byChar') {
		return 'character';
	}
	return 'object';
}

/**
 * Build the render plan for morphing `fromSlide` into `toSlide`.
 *
 * Returns `undefined` when there is nothing to morph (no matched pairs and
 * nothing to fade), so a caller can fall back to a plain transition.
 */
export function buildMorphTransitionPlan(
	fromSlide: PptxSlide | undefined,
	toSlide: PptxSlide | undefined,
	durationMs: number,
	mode: MorphMode = 'object',
): MorphTransitionPlan | undefined {
	if (!fromSlide || !toSlide) {
		return undefined;
	}
	const match = matchMorphElementsFull(fromSlide, toSlide);
	if (
		match.pairs.length === 0 &&
		match.unmatchedFrom.length === 0 &&
		match.unmatchedTo.length === 0
	) {
		return undefined;
	}

	const animations = generateFullMorphTransition(fromSlide, toSlide, durationMs, mode);

	// The overlay paints the outgoing slide as a moving copy of itself, in the
	// slide's own document order so its z-stacking is preserved:
	//
	//  - shapes with no counterpart fade out in place;
	//  - a matched pair's outgoing half glides onto its counterpart, dissolving
	//    into it when the appearance changed and simply landing on it when only
	//    the geometry did.
	//
	// Painting the unchanged halves too is what keeps a full-slide background
	// from hiding them: the overlay is one flat layer above the live stage, so
	// anything left out of it is invisible behind a crossfading backdrop until
	// that backdrop has faded. Before this, a near-duplicate slide pair (the
	// usual Morph authoring pattern) cut straight to its final look on frame 1
	// and looked like no transition at all (issue #131).
	//
	// Element ids embed their slide path, so the two id spaces do not overlap,
	// but partitioning on this set (rather than on id shape) keeps that an
	// implementation detail of core rather than an assumption here.
	//
	// The list is FLATTENED the same way the matcher flattens it (see
	// `morph-flatten`), against the SAME counterpart, so the two agree on which
	// groups were decomposed: the animations are keyed by the decomposed
	// children's ids. Painting the undecomposed group here instead would paint
	// the children twice over - once inside the group, once as their own ghosts
	// - and leave the group itself without an animation.
	const flattenedOutgoing = flattenMorphElements(fromSlide.elements, toSlide.elements);
	const outgoingIds = new Set(flattenedOutgoing.map((element) => element.id));
	const ghostIds = resolveMorphGhostIds(flattenedOutgoing, match.pairs);

	const incomingAnimations = new Map<string, string>();
	const outgoingAnimations = new Map<string, string>();
	const incomingImageAnimations = new Map<string, string>();
	const outgoingImageAnimations = new Map<string, string>();
	const keyframes: string[] = [];

	for (const animation of animations) {
		keyframes.push(animation.keyframes);
		const isOutgoing = outgoingIds.has(animation.elementId);
		// An `image`-targeted animation rides the `<img>` inside the element, so
		// it goes in its own map: it shares an element id with the container
		// animation and would otherwise overwrite it.
		const target =
			animation.target === 'image'
				? isOutgoing
					? outgoingImageAnimations
					: incomingImageAnimations
				: isOutgoing
					? outgoingAnimations
					: incomingAnimations;
		target.set(animation.elementId, animation.animation);
	}

	// Which outgoing shapes the overlay paints is `resolveMorphGhostIds`' call
	// and nothing else's: a shape whose ghost it drops draws the same thing on
	// the live stage along the same path, and painting it again in the overlay
	// would only hide what is arriving beneath it (issue #144 - the detail
	// slide's callouts never appeared until the overlay came down).
	//
	// Painted is NOT the same question as animated. A ghost standing in for an
	// inert pair is deliberately given no animation, because a running one would
	// put it on its own compositing layer and shift its raster by up to a pixel
	// for the duration (issue #161); it still has to be painted, so this asks
	// the ghost set directly rather than reading it off the animation map.
	const outgoingElements = flattenedOutgoing.filter((element) => ghostIds.has(element.id));

	// Everything the overlay paints hides whatever the live stage is doing
	// underneath, which is wrong for a shape that ARRIVES on top of a ghost:
	// it dissolves in where nobody can see it and appears in one frame when the
	// overlay is torn down (issue #146 - the wheel's centre disc is unchanged,
	// so its opaque ghost sat over the new title, body and button for the whole
	// morph). Those few move up into the overlay, above the ghosts, and the
	// copy on the stage is held invisible so the two never composite.
	//
	// Only a ghost that KEEPS its opacity counts. One that dissolves is out of
	// the way inside the first quarter, long before an arrival begins to appear,
	// so it hides nothing worth moving an animation for.
	const flattenedIncoming = flattenMorphElements(toSlide.elements, fromSlide.elements);
	const holdingGhostIds = new Set(
		match.pairs
			.filter(
				(candidate) =>
					ghostIds.has(candidate.fromElement.id) &&
					!morphPairNeedsCrossfade(candidate.fromElement, candidate.toElement),
			)
			.map((candidate) => candidate.fromElement.id),
	);
	// A matched pair's incoming half can be hidden by a holding ghost just as
	// easily as an arrival can - the wheel deck dissolves its centre wording
	// inside an unchanged opaque disc (issue #160) - but only one that DISSOLVES
	// IN may be lifted over its own ghost. One pinned at full strength has to
	// stay underneath it, or the crossfade becomes a cut.
	const dissolvingInIds = new Set(
		match.pairs
			.filter((candidate) =>
				morphPairIncomingFadesIn(
					candidate.fromElement,
					candidate.toElement,
					ghostIds.has(candidate.fromElement.id),
				),
			)
			.map((candidate) => candidate.toElement.id),
	);
	const lifted = resolveMorphOverlayArrivals(
		flattenedOutgoing,
		flattenedIncoming,
		match.pairs,
		holdingGhostIds,
		dissolvingInIds,
	);
	const overlayIncomingAnimations = new Map<string, string>();
	for (const id of lifted) {
		const animation = incomingAnimations.get(id);
		if (animation === undefined) {
			continue;
		}
		overlayIncomingAnimations.set(id, animation);
		incomingAnimations.set(id, `${LIFTED_HIDDEN_NAME} ${durationMs}ms linear forwards`);
	}
	if (overlayIncomingAnimations.size > 0) {
		keyframes.push(LIFTED_HIDDEN_KEYFRAMES);
	}
	const overlayIncomingElements = flattenedIncoming.filter((element) =>
		overlayIncomingAnimations.has(element.id),
	);

	return {
		keyframesCss: keyframes.join('\n'),
		incomingAnimations,
		outgoingAnimations,
		incomingImageAnimations,
		outgoingImageAnimations,
		overlayIncomingAnimations,
		outgoingElements,
		overlayIncomingElements,
		durationMs,
	};
}

/** Escape a value for use inside a double-quoted CSS attribute selector. */
function cssAttributeValue(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
}

/**
 * Render a plan as a self-contained stylesheet that drives the morph purely
 * through CSS, with no per-element prop plumbing.
 *
 * Every binding already stamps `data-element-id` on each rendered element, so
 * scoping rules to an ancestor carrying `scopeAttribute` is enough to animate
 * a whole slide. This is what lets Vue / Angular / Svelte / Vanilla play a
 * morph without threading an animation map through their slide-stage
 * components.
 *
 * @param plan - The plan to render.
 * @param scopeAttribute - Attribute (already present on the ancestor) that
 *   scopes these rules, e.g. `data-pptx-morph-incoming`. Pass an empty string
 *   to emit document-level rules: element ids embed their slide path, so they
 *   are unique to the slide being animated and need no ancestor to disambiguate.
 *   That is what lets a binding whose incoming slide is rendered OUTSIDE the
 *   overlay (Angular, React) still drive it from here.
 * @param which - Which half to emit: the live stage's `incoming` elements, the
 *   overlay's `outgoing` ghosts, or the `lifted` copies the overlay paints over
 *   those ghosts (see {@link MorphTransitionPlan.overlayIncomingElements}).
 * @returns Keyframes plus the scoped `animation` rules, ready to inject.
 */
export function buildMorphScopedCss(
	plan: MorphTransitionPlan,
	scopeAttribute: string,
	which: 'incoming' | 'outgoing' | 'lifted' = 'incoming',
): string {
	return `${plan.keyframesCss}\n${buildMorphAnimationRules(plan, scopeAttribute, which)}`;
}

/**
 * Just the `animation` rules of a plan, with no `@keyframes` block.
 *
 * For a binding that already injects {@link MorphTransitionPlan.keyframesCss}
 * itself and applies the element-level animations some other way (React merges
 * them into its per-element animation state), but still needs the descendant
 * rules that {@link MorphTransitionPlan.incomingImageAnimations} cannot be
 * expressed as an inline style for.
 *
 * @param plan - The plan to render.
 * @param scopeAttribute - As {@link buildMorphScopedCss}.
 * @param which - Which half of the transition to emit.
 * @param only - `'image'` emits only the `<img>` descendant rules; omit for all.
 * @returns The newline-joined rules (no trailing newline); `''` when there are none.
 */
export function buildMorphAnimationRules(
	plan: MorphTransitionPlan,
	scopeAttribute: string,
	which: 'incoming' | 'outgoing' | 'lifted' = 'incoming',
	only?: 'image',
): string {
	const prefix = scopeAttribute ? `[${scopeAttribute}] ` : '';
	const rules: string[] = [];
	const emit = (animations: Map<string, string>, suffix: string): void => {
		for (const [elementId, animation] of animations) {
			rules.push(
				`${prefix}[data-element-id="${cssAttributeValue(elementId)}"]${suffix} { animation: ${animation}; }`,
			);
		}
	};
	// `lifted` is the incoming half painted in the overlay rather than on the
	// stage, so it shares the incoming img channel and differs only in which
	// container animation it carries.
	if (only !== 'image') {
		emit(
			which === 'outgoing'
				? plan.outgoingAnimations
				: which === 'lifted'
					? plan.overlayIncomingAnimations
					: plan.incomingAnimations,
			'',
		);
	}
	// The picture-crop channel targets the `<img>` the element renders, which
	// every binding draws inside the `data-element-id` container.
	emit(which === 'outgoing' ? plan.outgoingImageAnimations : plan.incomingImageAnimations, ' img');
	return rules.join('\n');
}
