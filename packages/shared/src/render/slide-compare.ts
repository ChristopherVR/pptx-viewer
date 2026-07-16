/**
 * slide-compare — pure, framework-agnostic slide-diff engine shared by every
 * binding (React / Vue / Angular).
 *
 * Provides two entry points over the same element-diff core:
 *   - `comparePresentation(base, compare)` — diffs two full `PptxData` documents
 *     (the React surface).
 *   - `compareSlides(base, compare)` — diffs two `PptxSlide[]` arrays directly
 *     (the Vue editor-foundation surface), plus `compareSlide` for a single
 *     slide pair and `diffSlideElements` for the flattened element trees.
 *
 * DOM-free and side-effect-free.
 */
import type { PptxData, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlideDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export type ElementChangeKind = 'added' | 'removed' | 'moved' | 'resized' | 'textChanged';

export interface ElementChange {
	elementId: string;
	label: string;
	kind: ElementChangeKind;
	description: string;
}

export interface SlideDiff {
	status: SlideDiffStatus;
	/** Index in the base (current) presentation, or -1 for added slides. */
	baseIndex: number;
	/** Index in the compare (other) presentation, or -1 for removed slides. */
	compareIndex: number;
	/** The base slide data (undefined for added slides). */
	baseSlide?: PptxSlide;
	/** The compare slide data (undefined for removed slides). */
	compareSlide?: PptxSlide;
	/** Per-element changes when status is `changed`. */
	changes: ElementChange[];
}

export interface CompareResult {
	diffs: SlideDiff[];
	baseSlideCount: number;
	compareSlideCount: number;
	addedCount: number;
	removedCount: number;
	changedCount: number;
	unchangedCount: number;
}

// ---------------------------------------------------------------------------
// Tuning constants (px tolerances for position / size changes)
// ---------------------------------------------------------------------------

const POSITION_THRESHOLD = 2;
const SIZE_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Element helpers
// ---------------------------------------------------------------------------

function getElementText(element: PptxElement): string {
	if (!hasTextProperties(element)) {
		return '';
	}
	if (element.textSegments && element.textSegments.length > 0) {
		return element.textSegments.map((s) => s.text).join('');
	}
	return element.text ?? '';
}

function getElementLabel(element: PptxElement): string {
	const typeLabel = element.type.charAt(0).toUpperCase() + element.type.slice(1);
	const text = getElementText(element);
	if (text.length > 0) {
		const preview = text.length > 30 ? `${text.slice(0, 30)}...` : text;
		return `${typeLabel}: "${preview}"`;
	}
	return `${typeLabel} (${element.id})`;
}

/** Flatten an element tree, descending into group children. */
function collectElementsFlat(elements: PptxElement[]): PptxElement[] {
	const result: PptxElement[] = [];
	for (const el of elements) {
		result.push(el);
		if (el.type === 'group' && el.children) {
			result.push(...collectElementsFlat(el.children));
		}
	}
	return result;
}

function indexById(elements: PptxElement[]): Map<string, PptxElement> {
	const map = new Map<string, PptxElement>();
	for (const el of elements) {
		map.set(el.id, el);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Element-level diff
// ---------------------------------------------------------------------------

/**
 * Diff the (flattened) element trees of two slides into a list of changes:
 * added / removed elements, plus moved / resized / text-changed for elements
 * present in both. Matching is by stable element `id`.
 */
export function diffSlideElements(
	baseElements: PptxElement[],
	compareElements: PptxElement[],
): ElementChange[] {
	const changes: ElementChange[] = [];
	const baseById = indexById(collectElementsFlat(baseElements));
	const compareById = indexById(collectElementsFlat(compareElements));

	// Removed elements (in base but not in compare).
	for (const [id, el] of baseById) {
		if (!compareById.has(id)) {
			changes.push({
				elementId: id,
				label: getElementLabel(el),
				kind: 'removed',
				description: `Element removed: ${getElementLabel(el)}`,
			});
		}
	}

	// Added elements (in compare but not in base).
	for (const [id, el] of compareById) {
		if (!baseById.has(id)) {
			changes.push({
				elementId: id,
				label: getElementLabel(el),
				kind: 'added',
				description: `Element added: ${getElementLabel(el)}`,
			});
		}
	}

	// Changed elements (present in both).
	for (const [id, baseEl] of baseById) {
		const compareEl = compareById.get(id);
		if (!compareEl) {
			continue;
		}

		if (
			Math.abs(baseEl.x - compareEl.x) > POSITION_THRESHOLD ||
			Math.abs(baseEl.y - compareEl.y) > POSITION_THRESHOLD
		) {
			changes.push({
				elementId: id,
				label: getElementLabel(baseEl),
				kind: 'moved',
				description: `Moved from (${Math.round(baseEl.x)}, ${Math.round(baseEl.y)}) to (${Math.round(compareEl.x)}, ${Math.round(compareEl.y)})`,
			});
		}

		if (
			Math.abs(baseEl.width - compareEl.width) > SIZE_THRESHOLD ||
			Math.abs(baseEl.height - compareEl.height) > SIZE_THRESHOLD
		) {
			changes.push({
				elementId: id,
				label: getElementLabel(baseEl),
				kind: 'resized',
				description: `Resized from ${Math.round(baseEl.width)}x${Math.round(baseEl.height)} to ${Math.round(compareEl.width)}x${Math.round(compareEl.height)}`,
			});
		}

		const baseText = getElementText(baseEl);
		const compareText = getElementText(compareEl);
		if (baseText !== compareText) {
			changes.push({
				elementId: id,
				label: getElementLabel(baseEl),
				kind: 'textChanged',
				description: 'Text content changed',
			});
		}
	}

	return changes;
}

// ---------------------------------------------------------------------------
// Slide-pair diff (element + background + notes)
// ---------------------------------------------------------------------------

/**
 * Diff a single base/compare slide pair, producing element changes plus
 * background- and notes-level changes. Returns the change list (empty when the
 * slides are equivalent within tolerance).
 */
export function compareSlide(base: PptxSlide, compare: PptxSlide): ElementChange[] {
	const changes = diffSlideElements(base.elements, compare.elements);

	if (base.backgroundColor !== compare.backgroundColor) {
		changes.push({
			elementId: '__background__',
			label: 'Background',
			kind: 'textChanged',
			description: `Background changed from ${base.backgroundColor ?? 'default'} to ${compare.backgroundColor ?? 'default'}`,
		});
	}

	if ((base.notes ?? '') !== (compare.notes ?? '')) {
		changes.push({
			elementId: '__notes__',
			label: 'Speaker Notes',
			kind: 'textChanged',
			description: 'Speaker notes changed',
		});
	}

	return changes;
}

// ---------------------------------------------------------------------------
// Top-level slide-array compare
// ---------------------------------------------------------------------------

/**
 * Compare two slide arrays position-by-position, producing a {@link SlideDiff}
 * per slot: `removed` (only in base), `added` (only in compare), `changed`
 * (both present with differences), or `unchanged`.
 */
export function compareSlides(base: PptxSlide[], compare: PptxSlide[]): CompareResult {
	const diffs: SlideDiff[] = [];
	const maxLen = Math.max(base.length, compare.length);

	let addedCount = 0;
	let removedCount = 0;
	let changedCount = 0;
	let unchangedCount = 0;

	for (let i = 0; i < maxLen; i++) {
		const baseSlide = base[i] as PptxSlide | undefined;
		const compareSlideValue = compare[i] as PptxSlide | undefined;

		if (baseSlide && !compareSlideValue) {
			diffs.push({
				status: 'removed',
				baseIndex: i,
				compareIndex: -1,
				baseSlide,
				changes: [],
			});
			removedCount++;
		} else if (!baseSlide && compareSlideValue) {
			diffs.push({
				status: 'added',
				baseIndex: -1,
				compareIndex: i,
				compareSlide: compareSlideValue,
				changes: [],
			});
			addedCount++;
		} else if (baseSlide && compareSlideValue) {
			const changes = compareSlide(baseSlide, compareSlideValue);
			if (changes.length > 0) {
				diffs.push({
					status: 'changed',
					baseIndex: i,
					compareIndex: i,
					baseSlide,
					compareSlide: compareSlideValue,
					changes,
				});
				changedCount++;
			} else {
				diffs.push({
					status: 'unchanged',
					baseIndex: i,
					compareIndex: i,
					baseSlide,
					compareSlide: compareSlideValue,
					changes: [],
				});
				unchangedCount++;
			}
		}
	}

	return {
		diffs,
		baseSlideCount: base.length,
		compareSlideCount: compare.length,
		addedCount,
		removedCount,
		changedCount,
		unchangedCount,
	};
}

/**
 * Compare two full `PptxData` documents position-by-position. Mirrors
 * {@link compareSlides} but accepts `PptxData` and folds background/notes
 * changes into each `changed` slide's change list (the React surface).
 */
export function comparePresentation(base: PptxData, compare: PptxData): CompareResult {
	return compareSlides(base.slides as PptxSlide[], compare.slides as PptxSlide[]);
}

/** Accept one slide-level comparison result without mutating the current deck. */
export function applyAcceptSlide(slides: readonly PptxSlide[], diff: SlideDiff): PptxSlide[] {
	const next = [...slides];
	if (diff.status === 'added' && diff.compareSlide) {
		next.splice(Math.min(diff.compareIndex, next.length), 0, { ...diff.compareSlide });
	} else if (diff.status === 'changed' && diff.compareSlide && diff.baseIndex >= 0) {
		next[diff.baseIndex] = { ...diff.compareSlide };
	} else if (diff.status === 'removed' && diff.baseIndex >= 0) {
		next.splice(diff.baseIndex, 1);
	}
	return next;
}

/** Accept every slide-level comparison result in stable index order. */
export function applyAcceptAllSlides(
	slides: readonly PptxSlide[],
	compareResult: CompareResult,
): PptxSlide[] {
	const next = [...slides];
	const diffs = [...compareResult.diffs];
	for (const diff of diffs) {
		if (
			diff.status === 'changed' &&
			diff.compareSlide &&
			diff.baseIndex >= 0 &&
			diff.baseIndex < next.length
		) {
			next[diff.baseIndex] = { ...diff.compareSlide };
		}
	}
	for (let index = diffs.length - 1; index >= 0; index--) {
		const diff = diffs[index];
		if (diff.status === 'removed' && diff.baseIndex >= 0 && diff.baseIndex < next.length) {
			next.splice(diff.baseIndex, 1);
		}
	}
	for (const diff of diffs) {
		if (diff.status === 'added' && diff.compareSlide) {
			next.splice(Math.min(diff.compareIndex, next.length), 0, { ...diff.compareSlide });
		}
	}
	return next;
}
