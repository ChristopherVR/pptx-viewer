/**
 * Element matching logic for morph transitions.
 *
 * Matches elements between two consecutive slides using a multi-pass
 * strategy: explicit `!!` naming convention, element ID matching,
 * and type + proximity matching.
 *
 * @module render/morph-matching
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { MorphMatchResult, MorphPair } from './morph-types';
import { PROXIMITY_THRESHOLD } from './morph-types';

// ---------------------------------------------------------------------------
// Element name extraction
// ---------------------------------------------------------------------------

/**
 * Extract the morph-matching name from an element.
 *
 * Priority:
 * 1. Element name property from `cNvPr/@name` starting with "!!"
 * 2. Text content starting with "!!" (explicit morph name convention)
 *
 * PowerPoint matches elements across slides when their Selection Pane name
 * (i.e. `cNvPr/@name`) starts with `!!`. Elements with identical `!!`-prefixed
 * names are paired for morph animation regardless of type or position.
 *
 * @param element - The element to extract a morph name from.
 * @returns The morph name string, or undefined if none found.
 */
export function getElementMorphName(element: PptxElement): string | undefined {
	// Check !! naming convention on element name (cNvPr/@name) — primary source
	if (element.name) {
		const name = element.name.trim();
		if (name.startsWith('!!')) {
			return name;
		}
	}
	// Check !! naming convention in text content — fallback
	if (hasTextProperties(element) && element.text) {
		const text = element.text.trim();
		if (text.startsWith('!!')) {
			return text;
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
 *   2. Element ID matching (same `id` on both slides)
 *   3. Type + proximity matching (same type within 300px euclidean distance)
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

	// Pass 1: match by !! naming convention
	for (const fromEl of fromSlide.elements) {
		const fromName = getElementMorphName(fromEl);
		if (!fromName) {
			continue;
		}
		for (const toEl of toSlide.elements) {
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

	// Pass 2: match by element ID
	for (const fromEl of fromSlide.elements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		for (const toEl of toSlide.elements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (fromEl.id === toEl.id) {
				pairs.push({ fromElement: fromEl, toElement: toEl });
				usedFrom.add(fromEl.id);
				usedTo.add(toEl.id);
				break;
			}
		}
	}

	// Pass 3: match by same type + similar position (proximity)
	for (const fromEl of fromSlide.elements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		let bestMatch: PptxElement | null = null;
		let bestDist = Infinity;
		for (const toEl of toSlide.elements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (fromEl.type !== toEl.type) {
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

	// Collect unmatched elements
	const unmatchedFrom = fromSlide.elements.filter((el) => !usedFrom.has(el.id));
	const unmatchedTo = toSlide.elements.filter((el) => !usedTo.has(el.id));

	return { pairs, unmatchedFrom, unmatchedTo };
}
