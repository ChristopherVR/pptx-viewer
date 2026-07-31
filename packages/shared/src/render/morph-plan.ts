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

import { generateFullMorphTransition } from './morph-animation';
import { flattenMorphElements } from './morph-flatten';
import { matchMorphElementsFull } from './morph-matching';
import type { MorphMode } from './morph-types';

/** Everything needed to play one morph transition. */
export interface MorphTransitionPlan {
	/** All `@keyframes` blocks, to inject as a single stylesheet. */
	keyframesCss: string;
	/** Incoming-slide element id -> CSS `animation` shorthand. */
	incomingAnimations: Map<string, string>;
	/** Outgoing-slide element id -> CSS `animation` shorthand. */
	outgoingAnimations: Map<string, string>;
	/**
	 * The outgoing slide's elements, in document order, for the binding to
	 * render in its transition overlay for the duration of the morph. Each one
	 * carries an entry in {@link MorphTransitionPlan.outgoingAnimations}: it
	 * either fades out in place (no counterpart) or glides onto its counterpart,
	 * dissolving into it when the appearance changed.
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
	const outgoingElements = flattenMorphElements(fromSlide.elements, toSlide.elements);
	const outgoingIds = new Set(outgoingElements.map((element) => element.id));

	const incomingAnimations = new Map<string, string>();
	const outgoingAnimations = new Map<string, string>();
	const keyframes: string[] = [];

	for (const animation of animations) {
		keyframes.push(animation.keyframes);
		if (outgoingIds.has(animation.elementId)) {
			outgoingAnimations.set(animation.elementId, animation.animation);
		} else {
			incomingAnimations.set(animation.elementId, animation.animation);
		}
	}

	return {
		keyframesCss: keyframes.join('\n'),
		incomingAnimations,
		outgoingAnimations,
		outgoingElements,
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
 * @returns Keyframes plus the scoped `animation` rules, ready to inject.
 */
export function buildMorphScopedCss(
	plan: MorphTransitionPlan,
	scopeAttribute: string,
	which: 'incoming' | 'outgoing' = 'incoming',
): string {
	const animations = which === 'incoming' ? plan.incomingAnimations : plan.outgoingAnimations;
	const prefix = scopeAttribute ? `[${scopeAttribute}] ` : '';
	const rules: string[] = [];
	for (const [elementId, animation] of animations) {
		rules.push(
			`${prefix}[data-element-id="${cssAttributeValue(elementId)}"] { animation: ${animation}; }`,
		);
	}
	return `${plan.keyframesCss}\n${rules.join('\n')}`;
}
