/**
 * Element matching logic for morph transitions.
 *
 * Matches elements between two consecutive slides using a multi-pass
 * strategy: explicit `!!` naming convention, `a16:creationId` GUID identity,
 * the child correspondence that let two groups be decomposed, same-media
 * pictures, identical twins (same type / exact size / identical paint),
 * native shape-id matching (creationId-less decks only), and
 * type + proximity + size matching.
 *
 * @module render/morph-matching
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { flattenMorphElements, morphGroupChildPairs } from './morph-flatten';
import {
	conflictingMorphNames,
	differentText,
	matchGroupTwins,
	matchIdenticalTwins,
	matchSameMedia,
} from './morph-heuristics';
import { getElementMorphName } from './morph-name';
import type { MorphMatchResult, MorphPair } from './morph-types';
import { PROXIMITY_SIZE_RATIO_LIMIT, PROXIMITY_THRESHOLD } from './morph-types';

// ---------------------------------------------------------------------------
// Element name extraction
// ---------------------------------------------------------------------------

// The `!!` name lives in its own module so `morph-flatten` can read it without
// importing this one back (a cycle that breaks once the graph is bundled).
export { getElementMorphName } from './morph-name';

// ---------------------------------------------------------------------------
// Creation identity (`a16:creationId`)
// ---------------------------------------------------------------------------

/** Non-visual property containers a `p:cNvPr` can live under, per element kind. */
const NV_PR_KEYS = [
	'p:nvSpPr',
	'p:nvPicPr',
	'p:nvGrpSpPr',
	'p:nvCxnSpPr',
	'p:nvGraphicFramePr',
] as const;

/**
 * The shape's `a16:creationId` GUID from its preserved raw XML
 * (`p:cNvPr/a:extLst/a:ext/a16:creationId/@id`), or `undefined`.
 *
 * This is the identity PowerPoint itself tracks across slides: duplicating a
 * slide copies each shape's creationId, so equal GUIDs mean "the same shape,
 * possibly moved/restyled" with none of the ambiguity of the numeric
 * `p:cNvPr/@id` (which is just a per-slide counter that independently
 * authored slides reuse for unrelated shapes).
 */
export function getElementCreationId(element: PptxElement): string | undefined {
	const raw = element.rawXml as Record<string, unknown> | undefined;
	if (!raw) {
		return undefined;
	}
	for (const nvKey of NV_PR_KEYS) {
		const nvPr = raw[nvKey] as Record<string, unknown> | undefined;
		const cNvPr = nvPr?.['p:cNvPr'] as Record<string, unknown> | undefined;
		const extLst = cNvPr?.['a:extLst'] as Record<string, unknown> | undefined;
		const extRaw = extLst?.['a:ext'];
		if (!extRaw) {
			continue;
		}
		const exts = Array.isArray(extRaw) ? extRaw : [extRaw];
		for (const ext of exts) {
			const creation = (ext as Record<string, unknown>)?.['a16:creationId'] as
				| Record<string, unknown>
				| undefined;
			const guid = creation?.['@_id'];
			if (typeof guid === 'string' && guid.length > 0) {
				return guid;
			}
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Match elements between slides
// ---------------------------------------------------------------------------

/**
 * Match elements between two consecutive slides for morph transition.
 *
 * Matching passes (in priority order):
 *   1. Explicit !! naming convention (element name from cNvPr/@name, or text content)
 *   2a. `a16:creationId` GUID (PowerPoint's own cross-slide shape identity)
 *   2c. The child correspondence that let two groups be decomposed
 *   2d. Same media part (pictures: the same image)
 *   2e. Identical twins: same type, exact size, identical paint appearance
 *   2f. Group twins: same-size groups whose child casts correspond one for one
 *   2b. Native shape id from `p:cNvPr/@id` (only when creationIds are absent)
 *   3. Type + proximity + size matching (same type within 300px, similar box)
 *
 * Matching is per level of the shape tree: two groups that pair are decomposed
 * so their contents can pair too, and a group with no counterpart stays one
 * object (see `morph-flatten`).
 *
 * Returns only matched pairs (no unmatched elements).
 *
 * @param fromSlide - The outgoing slide.
 * @param toSlide - The incoming slide.
 * @returns An array of matched element pairs.
 */
export function matchMorphElements(fromSlide: PptxSlide, toSlide: PptxSlide): MorphPair[] {
	const result = matchMorphElementsFull(fromSlide, toSlide);
	return result.pairs;
}

/**
 * Full morph matching that also returns unmatched elements for fade in/out animations.
 *
 * @param fromSlide - The outgoing slide.
 * @param toSlide - The incoming slide.
 * @returns Matched pairs and unmatched elements on both sides.
 */
export function matchMorphElementsFull(fromSlide: PptxSlide, toSlide: PptxSlide): MorphMatchResult {
	const pairs: MorphPair[] = [];
	const usedFrom = new Set<string>();
	const usedTo = new Set<string>();

	// Two groups that pair with each other are decomposed into their children
	// (in absolute coordinates) so the contents can pair too, which is how
	// PowerPoint descends a matched container. A group with no counterpart -
	// including one whose `!!`-named shape sits top-level on the other slide -
	// stays whole and animates (or dissolves) as one unit. See `morph-flatten`.
	const fromElements = flattenMorphElements(fromSlide.elements, toSlide.elements);
	const toElements = flattenMorphElements(toSlide.elements, fromSlide.elements);

	// Pass 1: match by !! naming convention
	for (const fromEl of fromElements) {
		const fromName = getElementMorphName(fromEl);
		if (!fromName) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			const toName = getElementMorphName(toEl);
			if (toName === fromName) {
				pairs.push({ fromElement: fromEl, toElement: toEl });
				usedFrom.add(fromEl.id);
				usedTo.add(toEl.id);
				break;
			}
		}
	}

	// Pass 2a: match by `a16:creationId` GUID - the identity PowerPoint itself
	// preserves when a slide (or shape) is duplicated, and the strongest
	// "same shape" signal available. Equal GUIDs pair regardless of position,
	// which is exactly what a morph is for.
	const creationIds = new Map<string, string | undefined>();
	const creationIdOf = (el: PptxElement): string | undefined => {
		if (!creationIds.has(el.id)) {
			creationIds.set(el.id, getElementCreationId(el));
		}
		return creationIds.get(el.id);
	};
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		const fromGuid = creationIdOf(fromEl);
		if (!fromGuid) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id) || fromEl.type !== toEl.type) {
				continue;
			}
			if (creationIdOf(toEl) === fromGuid) {
				pairs.push({ fromElement: fromEl, toElement: toEl });
				usedFrom.add(fromEl.id);
				usedTo.add(toEl.id);
				break;
			}
		}
	}

	// Pass 2c: honour the correspondence that let two groups be decomposed.
	//
	// A group is only taken apart once its children have been shown to line up
	// one for one with the twin group's (see `morph-flatten`), so that pairing is
	// already established evidence by the time the flat list reaches this
	// function - and it is evidence the passes below cannot reconstruct, because
	// flattening threw the grouping away. Without it the wheel deck's three
	// centre text boxes fell through to pass 3, which refuses two text boxes that
	// sit in the same place and say different things, and every topic-to-topic
	// morph played them as an unmatched pair: gone by 23%, back from 42%, with an
	// empty panel in between (issue #160).
	const groupChildPairs = morphGroupChildPairs(fromSlide.elements, toSlide.elements);
	if (groupChildPairs.size > 0) {
		const toById = new Map(toElements.map((el) => [el.id, el]));
		for (const fromEl of fromElements) {
			if (usedFrom.has(fromEl.id)) {
				continue;
			}
			const toId = groupChildPairs.get(fromEl.id);
			const toEl = toId === undefined ? undefined : toById.get(toId);
			if (!toEl || usedTo.has(toEl.id) || fromEl.type !== toEl.type) {
				continue;
			}
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
		}
	}

	// Pass 2d: same media part (pictures).
	//
	// PowerPoint's by-object matcher pairs a picture with its counterpart even
	// when every id differs: slides authored independently number their shapes
	// from 1, so the same off-stage full-bleed photo can carry the same pane
	// name on both slides with a different `p:cNvPr/@id` AND a different
	// `a16:creationId` - and the name often differs too ("Picture 3" on one
	// slide, "Picture 7" on the other). What makes them the same object is the
	// identical image bytes. Without this pass the pair dissolves and the
	// picture pops in place instead of gliding in from off-stage.
	pairs.push(...matchSameMedia(fromElements, toElements, usedFrom, usedTo));

	// Pass 2e: identical twins - same type, the EXACT same box size and an
	// identical appearance signature, however far apart they sit.
	//
	// A title dimmed by a full-slide black overlay parked off one edge on the
	// outgoing slide and on-screen on the incoming one is the same object
	// twice over: same shape type, same box, same fill and line, different
	// name/ids/creationIds, and far beyond the proximity pass's 300px reach.
	// PowerPoint glides it in from the edge; two shapes indistinguishable
	// apart from where they sit are the same object as far as a morph is
	// concerned. The exact-size + identical-paint gate keeps the issue #131
	// wheel safe: its wedges differ in colour and size, so they still fall
	// through to proximity.
	pairs.push(...matchIdenticalTwins(fromElements, toElements, usedFrom, usedTo));

	// Pass 2f: group twins - whole GROUPS of the same box size whose child
	// casts correspond one for one, however far apart they sit.
	//
	// A title panel staged as a rotated full-slide group parked far above the
	// visible area on one slide and landed un-rotated on the next has nothing
	// a stronger pass can read: different name/ids/creationIds, different
	// position and angle - but the same box and a one-for-one child cast
	// (backdrop rectangle and title text box). PowerPoint glides the container
	// into place while un-rotating it; pairing the groups (instead of
	// decomposing them, which would bake the children out of their rotated
	// frame) reproduces that as one journey interpolating the box and the
	// angle.
	pairs.push(...matchGroupTwins(fromElements, toElements, usedFrom, usedTo));

	// Pass 2b: match by the shape's native OOXML id (`p:cNvPr/@id`) - a
	// fallback for decks whose producer emits no creationIds.
	//
	// This deliberately does NOT compare `element.id`: that is the loader's
	// synthetic identity and embeds the slide path
	// (`ppt/slides/slide3.xml-shape-1`), so it can never be equal across two
	// slides and the pass was dead code. `shapeId` is only unique WITHIN a
	// slide, hence the `usedFrom`/`usedTo` guards below.
	//
	// When BOTH shapes carry creationIds and pass 2a did not pair them, their
	// GUIDs differ: they are provably NOT the same object, and the numeric id
	// coinciding is an authoring accident. The issue #131 wheel deck reuses
	// the same ids AND names for DIFFERENT wedges on different topic slides
	// (shifted by one spTree position), and id-pairing there sent every wedge
	// and label gliding one sector around the wheel - the reporter's "phantom
	// arrow to another selected item". Such shapes must fall through to the
	// proximity pass (which pairs the same-position counterparts) instead.
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id) || !fromEl.shapeId) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (toEl.shapeId && fromEl.shapeId === toEl.shapeId && fromEl.type === toEl.type) {
				if (creationIdOf(fromEl) && creationIdOf(toEl)) {
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
	}

	// Pass 3: match by same type + similar position (proximity) + similar SIZE.
	//
	// The size gate matters as much as the distance one. A morph pair is
	// animated by interpolating the whole box (translate + scale), so pairing
	// two nearby elements of very different sizes stretches one into the other:
	// in the issue #131 deck, a slide's small centre-text group sat 65px from
	// the next slide's 270x270 group holding the ENTIRE highlighted wheel wedge,
	// and pairing them made the wedge fly in squashed to half height while the
	// old text stretched to double - a visibly "broken" wheel and a phantom
	// selection marker mid-glide. Same-shaped counterparts pass at ratio 1;
	// anything more than 2x apart on either axis dissolves in place instead,
	// which is what PowerPoint does with shapes it cannot confidently pair.
	//
	// Candidates are collected first and claimed CLOSEST-PAIR-FIRST across the
	// whole slide, not per `fromEl` in document order. Taking each `fromEl`'s
	// own best candidate in array order lets an element with a mediocre-but-
	// valid fallback claim a partner a LATER element was unambiguously closer
	// to, starving that later element of the one candidate it had: two shapes
	// 8px and 2px from the same target, processed 8px-first, left the 2px shape
	// unmatched (and crossfading) even though nothing about it was ambiguous.
	// Sorting by distance first means the closest claim always wins the
	// contested partner, which only ever RESCUES a pairing this pass would
	// otherwise have missed - every gate above still applies per candidate, so
	// this cannot pair anything the checks above would have refused.
	interface ProximityCandidate {
		fromEl: PptxElement;
		toEl: PptxElement;
		dist: number;
	}
	const candidates: ProximityCandidate[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (fromEl.type !== toEl.type) {
				continue;
			}
			// Proximity is the weakest signal there is: it says two elements sit
			// in the same place, not that they are the same object. For TEXT that
			// is not enough. The issue #131 deck rebuilds its centre panel on
			// every topic slide with fresh text boxes - different `shapeId`,
			// different name, different words, near-identical box - so this pass
			// paired "Multi-Domain Fusion" with "Cyber and EM Spectrum" and glided
			// one into the other, moving 11px and squeezing 193px of box down to
			// 172px while the words dissolved. PowerPoint has no identity to match
			// on there either, and simply fades the old out and the new in.
			//
			// Anything the author really did carry across keeps its `a16:creationId`
			// (pass 2a) or its `!!` name (pass 1) and never reaches this pass, so
			// gating here costs a real morph nothing.
			if (differentText(fromEl, toEl)) {
				continue;
			}
			// An explicit `!!` name that disagrees is the author saying these are
			// two different objects; proximity must not overrule it.
			if (conflictingMorphNames(fromEl, toEl)) {
				continue;
			}
			const widthRatio =
				Math.max(fromEl.width, toEl.width, 1) / Math.max(Math.min(fromEl.width, toEl.width), 1);
			const heightRatio =
				Math.max(fromEl.height, toEl.height, 1) / Math.max(Math.min(fromEl.height, toEl.height), 1);
			if (widthRatio > PROXIMITY_SIZE_RATIO_LIMIT || heightRatio > PROXIMITY_SIZE_RATIO_LIMIT) {
				continue;
			}
			const dx = fromEl.x - toEl.x;
			const dy = fromEl.y - toEl.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < PROXIMITY_THRESHOLD) {
				candidates.push({ fromEl, toEl, dist });
			}
		}
	}
	candidates.sort((a, b) => a.dist - b.dist);
	for (const candidate of candidates) {
		if (usedFrom.has(candidate.fromEl.id) || usedTo.has(candidate.toEl.id)) {
			continue;
		}
		pairs.push({ fromElement: candidate.fromEl, toElement: candidate.toEl });
		usedFrom.add(candidate.fromEl.id);
		usedTo.add(candidate.toEl.id);
	}

	// There is deliberately no further pass pairing leftovers that merely
	// occupy the same box across element types. One used to exist, to carry the
	// issue #131 wheel's centre through as one object where the overview slide
	// holds it as a bare `!!Content` shape and the topic slides wrap the same
	// artwork in a `!!Circle` group of the identical box. PowerPoint does not:
	// sampled frames of the real transition show that centre dissolving out to
	// the artwork behind it (RGB 39,40,42 -> 174,194,204 by 324ms) and back in,
	// which is what an UNMATCHED pair looks like. Pairing a shape with a group
	// held it solid instead, so the ghost never dissolved and the incoming half
	// popped.
	//
	// Collect unmatched elements
	const unmatchedFrom = fromElements.filter((el) => !usedFrom.has(el.id));
	const unmatchedTo = toElements.filter((el) => !usedTo.has(el.id));

	return { pairs, unmatchedFrom, unmatchedTo };
}
