/**
 * Stacking-order (z-index) journeys for stage-journeyed morph pairs.
 *
 * A stage-journeyed pair is painted directly on the live stage, in the
 * INCOMING slide's document order, so a pair whose stacking order swaps
 * between the two slides would pop to its new layer at frame 1 and never show
 * the outgoing slide's front relationship. The journeys computed here make
 * the browser step the swap while the shapes are mid-flight (PowerPoint
 * interpolates z-order continuously; a stepped swap synced to the motion is
 * the closest a discrete layer model gets). Pairs with ghosts are handled by
 * the overlay-order machinery instead (see `morph-overlay-order`).
 *
 * The journey values are REAL stage z-indices, never bare document indices:
 * the stage assigns `zIndexBase + index` to each top-level slide element (a
 * binding that paints master/layout shapes beneath the slide offsets the base
 * by their count), and a decomposed group's children stack inside the group's
 * own context by child index. A journey written in any other space lands the
 * pair behind (or above) every unrelated element for the whole morph.
 *
 * Everything here is pure.
 *
 * @module render/morph-z-order
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

import type { MorphPair } from './morph-types';

/** A z-index journey: the layer to start on and the element's own static layer. */
export interface ZOrderJourney {
	readonly from: number;
	readonly to: number;
}

/** Where an incoming element is stacked: which context, and at what z-index. */
interface StackSlot {
	/** `'stage'` for a top-level element, else the id of the group it lives in. */
	readonly context: string;
	readonly z: number;
}

/**
 * The stacking slot of every element the stage will render for the incoming
 * slide: top-level elements at `zIndexBase + index`, the direct children of a
 * group at their child index inside that group's context. Deeper nesting is
 * left out; a journey cannot reach across stacking contexts anyway.
 */
function incomingStackSlots(
	toElements: readonly PptxElement[],
	zIndexBase: number,
): Map<string, StackSlot> {
	const slots = new Map<string, StackSlot>();
	toElements.forEach((element, index) => {
		slots.set(element.id, { context: 'stage', z: zIndexBase + index });
		const children = (element as GroupPptxElement).children;
		if (element.type === 'group' && Array.isArray(children)) {
			children.forEach((child, childIndex) => {
				slots.set(child.id, { context: element.id, z: childIndex });
			});
		}
	});
	return slots;
}

/**
 * Stage-journeyed matched pairs whose stacking ORDER changes between the
 * slides, as incoming element id -> z-index journey.
 *
 * Within one stacking context, the journeyed elements share a fixed set of
 * layers (their incoming z-indices). Each starts on the layer its OUTGOING
 * rank would occupy among that set and ends on its own, so a pair that was in
 * front on the leaving slide begins the morph in front and steps behind
 * mid-flight, whatever else the stage stacks around it. Elements whose rank
 * does not change get no journey.
 *
 * @param pairs - Matched pairs from the morph matching pass.
 * @param flattenedFrom - The outgoing slide's elements in paint order (the
 *   flattened list the matcher worked on): decides who was in front.
 * @param toElements - The incoming slide's TOP-LEVEL elements, in document
 *   order: decides the real z-index each half rests on.
 * @param ghostIds - Outgoing ids the overlay paints; those pairs are skipped.
 * @param zIndexBase - The z-index the stage gives the first top-level element
 *   (a binding painting template shapes beneath the slide offsets by their count).
 */
export function computeZOrderSwaps(
	pairs: readonly MorphPair[],
	flattenedFrom: readonly PptxElement[],
	toElements: readonly PptxElement[],
	ghostIds?: ReadonlySet<string>,
	zIndexBase = 0,
): Map<string, ZOrderJourney> {
	const outIndex = new Map(flattenedFrom.map((el, i) => [el.id, i] as const));
	const slots = incomingStackSlots(toElements, zIndexBase);

	// Group the stage-journeyed pairs by the stacking context their incoming
	// half renders in; a journey only reorders elements that share one.
	const byContext = new Map<string, { toId: string; out: number; z: number }[]>();
	for (const pair of pairs) {
		if (ghostIds?.has(pair.fromElement.id)) {
			continue;
		}
		const out = outIndex.get(pair.fromElement.id);
		const slot = slots.get(pair.toElement.id);
		if (out === undefined || !slot) {
			continue;
		}
		const members = byContext.get(slot.context) ?? [];
		members.push({ toId: pair.toElement.id, out, z: slot.z });
		byContext.set(slot.context, members);
	}

	const journeys = new Map<string, ZOrderJourney>();
	for (const members of byContext.values()) {
		if (members.length < 2) {
			continue;
		}
		const layers = members.map((m) => m.z).sort((a, b) => a - b);
		const byOutgoingOrder = [...members].sort((a, b) => a.out - b.out);
		byOutgoingOrder.forEach((member, rank) => {
			const from = layers[rank];
			if (from !== member.z) {
				journeys.set(member.toId, { from, to: member.z });
			}
		});
	}
	return journeys;
}
