/**
 * Element matching logic for morph transitions.
 *
 * Matches elements between two consecutive slides using a multi-pass
 * strategy: explicit `!!` naming convention, `a16:creationId` GUID identity,
 * native shape-id matching (creationId-less decks only), and
 * type + proximity + size matching.
 *
 * @module render/morph-matching
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { flattenMorphElements } from './morph-flatten';
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
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		let bestMatch: PptxElement | null = null;
		let bestDist = Infinity;
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (fromEl.type !== toEl.type) {
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
			if (dist < bestDist && dist < PROXIMITY_THRESHOLD) {
				bestDist = dist;
				bestMatch = toEl;
			}
		}
		if (bestMatch) {
			pairs.push({ fromElement: fromEl, toElement: bestMatch });
			usedFrom.add(fromEl.id);
			usedTo.add(bestMatch.id);
		}
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
