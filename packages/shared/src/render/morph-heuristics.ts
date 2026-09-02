/**
 * The weaker morph matching passes.
 *
 * PowerPoint's by-object matcher does not stop at explicit identity
 * (`!!` names, `a16:creationId`): real decks show it also pairs a picture
 * with its counterpart across independently-authored slides (same
 * `cNvPr/@name`, same image bytes, every id different) and glides in a
 * full-slide overlay whose twin is identical apart from where it sits. These
 * passes reproduce that without overreaching: media identity is exact, and
 * the twin pass demands the same type, the exact same box size and the same
 * resolved paint, so the issue #131 wheel (same ids and names, different
 * colours and sizes) keeps falling through to proximity.
 *
 * Everything here is pure; the pass bookkeeping (used-element sets) is owned
 * by `morph-matching`, which calls into this module one-way. The shared
 * evidence predicates live in `morph-predicates`, and the same-media pass's
 * minimum-cost solver in `morph-media-assignment`.
 *
 * @module render/morph-heuristics
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

import { correspondingChildren } from './morph-flatten';
import { minCostMediaAssignment } from './morph-media-assignment';
import type { MediaCandidate } from './morph-media-assignment';
import {
	appearanceSignature,
	centreDistance,
	conflictingMorphNames,
	differentText,
	hasDeclaredPaint,
	sameMediaPicture,
} from './morph-predicates';
import type { MorphPair } from './morph-types';

/**
 * Pass: pair pictures that paint the SAME media part, even when every id - and
 * often the `cNvPr/@name` - differs.
 *
 * Independently-authored slides number their shapes from 1, so "the same
 * picture" is never the ids (or the creationIds) agreeing: it is the image
 * bytes agreeing. A full-bleed photo that slides into view is typically
 * auto-named differently on each slide ("Picture 3" on one, "Picture 7" on
 * the other); pairing by media is what makes it glide instead of fading in.
 *
 * When MANY pictures share one media part the choice is global, not greedy.
 * A staged artwork can be a base plus several cropped tiles, all the same
 * media, several PARKED ON EXACTLY THE SAME CORNER - and a uniform slide-up
 * shift leaves alternative bijections whose TOTAL travel equals the true one,
 * so neither nearest-first greedy nor cardinality-first augmenting paths can
 * tell them apart. The pass therefore runs a minimum-cost assignment
 * (Hungarian, see `morph-media-assignment`) over every legal pairing edge,
 * where an edge's cost ranks the same preferences pair by pair: same
 * Selection Pane name beats unnamed regardless of distance, nearer beats
 * farther, an equally reachable box of the same size beats a mismatched one,
 * and input order breaks whatever ties remain.
 */
export function matchSameMedia(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const candidatesOf = new Map<string, MediaCandidate[]>();
	for (let i = 0; i < fromElements.length; i++) {
		const fromEl = fromElements[i];
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		const fromName = fromEl.name?.trim();
		const candidates: MediaCandidate[] = [];
		for (let j = 0; j < toElements.length; j++) {
			const toEl = toElements[j];
			if (usedTo.has(toEl.id) || !sameMediaPicture(fromEl, toEl)) {
				continue;
			}
			candidates.push({
				to: toEl,
				named: Boolean(fromName) && toEl.name?.trim() === fromName,
				dist: centreDistance(fromEl, toEl),
				sizeDelta: Math.abs(toEl.width - fromEl.width) + Math.abs(toEl.height - fromEl.height),
				toIndex: j,
			});
		}
		if (candidates.length > 0) {
			candidatesOf.set(fromEl.id, candidates);
		}
	}
	if (candidatesOf.size === 0) {
		return [];
	}

	const assignment = minCostMediaAssignment(candidatesOf);

	const toById = new Map(toElements.map((el) => [el.id, el] as const));
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		const candidates = candidatesOf.get(fromEl.id);
		const col = assignment.get(fromEl.id);
		if (!candidates || col === undefined || usedFrom.has(fromEl.id)) {
			continue;
		}
		const toEl = toById.get(candidates[col].to.id);
		if (toEl) {
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
		}
	}
	return pairs;
}

/**
 * Whether two elements are groups of the SAME box size whose children line up
 * one for one (each child pairs by `!!` name, pane name, or a >= 50% box
 * overlap - the same evidence the flattener reads before decomposing a pair)
 * and which read the same. The words veto stays: two near-by panels that say
 * different things are a rebuilt panel, not one container that moved (issue
 * #144's drifting text).
 */
function sameSizedTwinCasts(a: PptxElement, b: PptxElement): boolean {
	if (a.type !== 'group' || b.type !== 'group') {
		return false;
	}
	if (a.width !== b.width || a.height !== b.height) {
		return false;
	}
	if (conflictingMorphNames(a, b)) {
		return false;
	}
	if (differentText(a, b)) {
		return false;
	}
	const aChildren = (a as GroupPptxElement).children;
	const bChildren = (b as GroupPptxElement).children;
	if (!Array.isArray(aChildren) || !Array.isArray(bChildren)) {
		return false;
	}
	return correspondingChildren(aChildren, bChildren) !== undefined;
}

/**
 * Pass: pair TEXT elements that carry the same Selection Pane NAME, the same
 * box size and the same words, however far apart they sit.
 *
 * A headline parked far off-stage on one slide and re-landed on-screen on the
 * next is the same object to PowerPoint and the reader: same pane name,
 * byte-identical box, identical words, different `a16:creationId`. No other
 * pass can take it: media is pictures-only, the identical-twin pass demands
 * DECLARED paint which a text box never has, and proximity caps at 300px - so
 * the headline dissolved out and faded in instead of sliding with the rest of
 * its panel. Name + box + words together are as strong an identity statement
 * as paint is for shapes; a rebuilt headline says different words and stays
 * excluded by the words veto.
 */
export function matchNamedTextTwins(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id) || fromEl.type !== 'text') {
			continue;
		}
		const fromName = fromEl.name?.trim();
		if (!fromName) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id) || toEl.type !== 'text') {
				continue;
			}
			if (toEl.name?.trim() !== fromName) {
				continue;
			}
			if (
				Math.abs(fromEl.width - toEl.width) > 0.5 ||
				Math.abs(fromEl.height - toEl.height) > 0.5
			) {
				continue;
			}
			if (differentText(fromEl, toEl)) {
				continue;
			}
			if (conflictingMorphNames(fromEl, toEl)) {
				continue;
			}
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
			break;
		}
	}
	return pairs;
}

/**
 * Pass: pair whole GROUPS whose casts correspond, even when every id differs.
 *
 * A title staged as a rotated full-slide group parked far above the visible
 * area on one slide and landed un-rotated on the next shares nothing a
 * stronger pass can read - different `p:cNvPr/@id`, different
 * `a16:creationId`, often a different name, position and angle - but it is
 * the same object to a reader: the same box size, the same words, and
 * children (a backdrop rectangle and a title text box) pairing one for one.
 * PowerPoint glides the container into place while un-rotating it; pairing
 * the groups (rather than decomposing them, which would bake the children
 * out of their rotated frame) reproduces that as one journey interpolating
 * the box and the angle.
 */
export function matchGroupTwins(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (!sameSizedTwinCasts(fromEl, toEl)) {
				continue;
			}
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
			break;
		}
	}
	return pairs;
}

/**
 * Pass: pair "identical twins" - same type, the EXACT same box size and an
 * identical DECLARED paint (explicit fill/stroke) - no matter how far apart
 * they sit. The distance-agnostic counterpart of the proximity pass: for two
 * shapes that are indistinguishable apart from where they are, interpolating
 * the box is what PowerPoint does, and what a morph is for. Unstyled shapes
 * carry no such statement and stay unmatched (see `hasDeclaredPaint`).
 */
export function matchIdenticalTwins(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		if (!hasDeclaredPaint(fromEl)) {
			continue;
		}
		const fromSignature = appearanceSignature(fromEl);
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (appearanceSignature(toEl) !== fromSignature) {
				continue;
			}
			if (fromEl.width !== toEl.width || fromEl.height !== toEl.height) {
				continue;
			}
			// Same-place-different-words is a rebuilt panel, not a moved object.
			if (differentText(fromEl, toEl)) {
				continue;
			}
			// An explicit `!!` name that disagrees is the author saying these
			// are two different objects.
			if (conflictingMorphNames(fromEl, toEl)) {
				continue;
			}
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
			break;
		}
	}
	return pairs;
}
