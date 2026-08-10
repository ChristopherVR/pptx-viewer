/**
 * Who is allowed to hide whom during a morph.
 *
 * A morph is played as two stacked layers: the live stage draws the INCOMING
 * slide, and a transition overlay above it paints ghosts of the outgoing one
 * (see `morph-plan`). That split is only faithful while every ghost genuinely
 * belongs on top of everything the stage is drawing. It does not, in general:
 * PowerPoint composites one merged scene, in which an object arriving on the
 * incoming slide can perfectly well sit ABOVE a shape that persists from the
 * outgoing one.
 *
 * When it does, the flat overlay hides it for the whole transition. Issue #146
 * is exactly that: the wheel deck's centre disc (`!!Content`) is unchanged
 * between the two slides, so its ghost is painted opaque for the full duration,
 * and the title, body and button dissolving in INSIDE that disc were invisible
 * until the overlay was torn down - the new wording appeared in a single frame
 * at the end instead of cross-dissolving with the old.
 *
 * This module decides which incoming shapes have to be lifted into the overlay
 * as well, by ranking both slides' shapes in one merged z-order.
 *
 * @module render/morph-overlay-order
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { MorphPair } from './morph-types';

/** Axis-aligned box, used only to ask whether one shape can hide another. */
export interface MorphBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** The area a shape occupies over the whole morph (start box union end box). */
export function travelledBox(from: PptxElement, to?: PptxElement): MorphBox {
	const boxes = to ? [from, to] : [from];
	return {
		left: Math.min(...boxes.map((element) => element.x)),
		top: Math.min(...boxes.map((element) => element.y)),
		right: Math.max(...boxes.map((element) => element.x + element.width)),
		bottom: Math.max(...boxes.map((element) => element.y + element.height)),
	};
}

/** Whether two travelled boxes share any area. */
export function boxesOverlap(a: MorphBox, b: MorphBox): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Rank every shape of both slides in a single back-to-front order.
 *
 * A matched pair is ONE object and gets ONE rank, so "is this arrival above
 * that ghost?" is a plain number comparison. The two document orders are merged
 * the way a diff merges two revisions of a list: walking the incoming slide,
 * each matched shape first flushes everything the outgoing slide drew below its
 * counterpart, so departures keep their place relative to the shapes that
 * surrounded them and arrivals keep theirs.
 *
 * Both lists must already be flattened the way the matcher flattens them (see
 * `morph-flatten`), or the ids will not line up with `pairs`.
 *
 * @param outgoing - The outgoing slide's elements, flattened, in document order.
 * @param incoming - The incoming slide's elements, flattened, in document order.
 * @param pairs - The matched pairs.
 * @returns Element id -> rank; higher is nearer the viewer.
 */
export function buildMorphMergedOrder(
	outgoing: readonly PptxElement[],
	incoming: readonly PptxElement[],
	pairs: readonly MorphPair[],
): Map<string, number> {
	const partnerOf = new Map(pairs.map((pair) => [pair.toElement.id, pair.fromElement.id]));
	const outgoingIndex = new Map(outgoing.map((element, index) => [element.id, index]));
	const rank = new Map<string, number>();
	let next = 0;
	let cursor = 0;

	/** Emit every outgoing shape below `limit` that has not been placed yet. */
	const flushOutgoingBelow = (limit: number): void => {
		while (cursor < limit) {
			const element = outgoing[cursor];
			cursor += 1;
			if (!rank.has(element.id)) {
				rank.set(element.id, next);
				next += 1;
			}
		}
	};

	for (const element of incoming) {
		const partner = partnerOf.get(element.id);
		const partnerIndex = partner === undefined ? undefined : outgoingIndex.get(partner);
		if (partner === undefined || partnerIndex === undefined) {
			// An arrival holds its own place in the incoming slide's stack.
			rank.set(element.id, next);
			next += 1;
			continue;
		}
		flushOutgoingBelow(partnerIndex + 1);
		rank.set(element.id, rank.get(partner) ?? next);
	}
	flushOutgoingBelow(outgoing.length);

	return rank;
}

/**
 * The incoming shapes the overlay has to paint over its ghosts.
 *
 * An arriving shape is lifted when a ghost that HOLDS ITS OPACITY sits below it
 * in the merged order and covers it: on the live stage it would dissolve in
 * underneath something opaque and never be seen at all. Anything the ghosts are
 * legitimately on top of - the incoming slide's own backdrop, artwork the
 * persisting shapes are drawn over - keeps its place on the stage.
 *
 * A ghost that DISSOLVES is deliberately not counted, which is why the caller
 * passes only the holding ones. It stops hiding anything within the first
 * quarter of the morph, well before an arrival starts to appear at 42% (see
 * `MORPH_FADE_OUT_END_PERCENT` / `MORPH_FADE_IN_START_PERCENT`), so lifting for
 * it buys nothing and moves an animation the live stage should own: issue
 * #131's overview-to-topic hop dissolves the whole centre out and the arriving
 * group in, exactly that way.
 *
 * A matched pair qualifies only when its incoming half DISSOLVES IN, which the
 * caller states in `dissolvingInIds`. A half that is pinned at full strength
 * (anything painting a body, which would go see-through if both halves faded)
 * has to stay under its own ghost, or its dissolve becomes a cut. A half that
 * fades in may be lifted: it then dissolves over its ghost instead of under it,
 * which differs only where the two shapes' own ink overlaps.
 *
 * This is not a corner case. The wheel deck's centre panel keeps an unchanged
 * opaque disc, and the wording inside it is a matched pair once the panels'
 * casts line up (issue #160), so without this the new wording dissolved in
 * behind that disc's ghost and only appeared when the overlay came down: the
 * same defect issue #146 fixed for the unmatched case, reached by a different
 * road.
 *
 * @param outgoing - The outgoing slide's elements, flattened, in document order.
 * @param incoming - The incoming slide's elements, flattened, in document order.
 * @param pairs - The matched pairs.
 * @param holdingGhostIds - The outgoing ids the overlay paints AND keeps opaque
 *   for the whole morph (a painted pair whose appearance did not change).
 * @param dissolvingInIds - Incoming ids of matched pairs whose incoming half
 *   fades in (see `morphPairIncomingFadesIn`). Defaults to none, the behaviour
 *   before matched pairs could be lifted.
 * @returns The ids of the incoming elements to lift, a subset of `incoming`.
 */
export function resolveMorphOverlayArrivals(
	outgoing: readonly PptxElement[],
	incoming: readonly PptxElement[],
	pairs: readonly MorphPair[],
	holdingGhostIds: ReadonlySet<string>,
	dissolvingInIds: ReadonlySet<string> = new Set(),
): Set<string> {
	const rank = buildMorphMergedOrder(outgoing, incoming, pairs);
	const matched = new Set(pairs.map((pair) => pair.toElement.id));
	const counterpart = new Map(pairs.map((pair) => [pair.fromElement.id, pair.toElement]));
	const ghosts = outgoing
		.filter((element) => holdingGhostIds.has(element.id))
		.map((element) => ({
			rank: rank.get(element.id) ?? 0,
			box: travelledBox(element, counterpart.get(element.id)),
		}));

	const lifted = new Set<string>();
	for (const element of incoming) {
		if (matched.has(element.id) && !dissolvingInIds.has(element.id)) {
			continue;
		}
		const mine = rank.get(element.id) ?? 0;
		const box = travelledBox(element);
		if (ghosts.some((ghost) => ghost.rank < mine && boxesOverlap(ghost.box, box))) {
			lifted.add(element.id);
		}
	}
	return lifted;
}
