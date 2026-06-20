/**
 * element-operations: Pure array-transformation functions for slide elements.
 *
 * All functions are framework-agnostic (no framework imports). Each takes a
 * `readonly PptxElement[]` representing the ordered element list for a slide
 * (array index 0 = back, last index = front/top in paint order) and returns a
 * NEW array; the input is never mutated.
 *
 * Callers supply a `newId` wherever a new element identity is needed, keeping
 * these functions deterministic and side-effect-free.
 */

import type { PptxElement } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Smallest permitted width or height after a resize operation (in EMU or px). */
const MIN_ELEMENT_SIZE = 1;

/** Default nudge offset applied when duplicating an element (same units as x/y). */
const DEFAULT_DUPLICATE_OFFSET = 20;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return a shallow copy of `el` with `patch` merged in, preserving the
 * discriminant `type` field even if `patch` accidentally carries a different
 * one (the cast is safe because we re-assert the original type).
 */
function mergeElement(el: PptxElement, patch: Partial<PptxElement>): PptxElement {
	return { ...el, ...patch, type: el.type } as PptxElement;
}

/**
 * Return a shallow copy of `elements` with every element unchanged except the
 * one whose `id === targetId`, which is replaced by `replacer(el)`.
 * If no element matches, the original array is returned (no allocation).
 */
function mapById(
	elements: readonly PptxElement[],
	targetId: string,
	replacer: (el: PptxElement) => PptxElement,
): PptxElement[] {
	let matched = false;
	const next = elements.map((el) => {
		if (el.id !== targetId) {
			return el;
		}
		matched = true;
		return replacer(el);
	});
	return matched ? next : (elements as PptxElement[]);
}

// ---------------------------------------------------------------------------
// Exported pure operations
// ---------------------------------------------------------------------------

/**
 * Shallow-merge `patch` onto the element with `id`.
 * The discriminant `type` is always preserved from the original element.
 *
 * @example
 *   updateElementById(elements, 'el1', { x: 50, hidden: true })
 */
export function updateElementById(
	elements: readonly PptxElement[],
	id: string,
	patch: Partial<PptxElement>,
): PptxElement[] {
	return mapById(elements, id, (el) => mergeElement(el, patch));
}

/**
 * Translate the element by `(dx, dy)` relative to its current position.
 *
 * @example
 *   moveElementBy(elements, 'el1', 10, -5)
 */
export function moveElementBy(
	elements: readonly PptxElement[],
	id: string,
	dx: number,
	dy: number,
): PptxElement[] {
	return mapById(elements, id, (el) => mergeElement(el, { x: el.x + dx, y: el.y + dy }));
}

/**
 * Set the absolute position of the element with `id`.
 *
 * @example
 *   setElementPosition(elements, 'el1', 100, 200)
 */
export function setElementPosition(
	elements: readonly PptxElement[],
	id: string,
	x: number,
	y: number,
): PptxElement[] {
	return mapById(elements, id, (el) => mergeElement(el, { x, y }));
}

/**
 * Set the size of the element with `id`, clamping both dimensions to at
 * least `MIN_ELEMENT_SIZE` (mirrors React's min-size guard).
 *
 * @example
 *   resizeElement(elements, 'el1', 300, 150)
 */
export function resizeElement(
	elements: readonly PptxElement[],
	id: string,
	width: number,
	height: number,
): PptxElement[] {
	const w = Math.max(MIN_ELEMENT_SIZE, width);
	const h = Math.max(MIN_ELEMENT_SIZE, height);
	return mapById(elements, id, (el) => mergeElement(el, { width: w, height: h }));
}

/**
 * Remove all elements whose `id` is contained in `ids`.
 * Elements not in `ids` are returned in their original order.
 *
 * @example
 *   deleteElementsByIds(elements, ['el1', 'el3'])
 */
export function deleteElementsByIds(
	elements: readonly PptxElement[],
	ids: readonly string[],
): PptxElement[] {
	if (ids.length === 0) {
		return elements as PptxElement[];
	}
	const idSet = new Set<string>(ids);
	return elements.filter((el) => !idSet.has(el.id));
}

/**
 * Insert a copy of the element with `id` at the end of the array, using
 * `newId` as the copy's identity.  The copy is nudged by `offset` on both
 * axes so it does not exactly overlap the original.
 *
 * The caller is responsible for supplying a unique `newId`, keeping this
 * function pure and deterministic.
 *
 * @example
 *   duplicateElementById(elements, 'el1', crypto.randomUUID(), 20)
 */
export function duplicateElementById(
	elements: readonly PptxElement[],
	id: string,
	newId: string,
	offset: number = DEFAULT_DUPLICATE_OFFSET,
): PptxElement[] {
	const source = elements.find((el) => el.id === id);
	if (source === undefined) {
		return elements as PptxElement[];
	}
	const copy: PptxElement = mergeElement(source, {
		id: newId,
		x: source.x + offset,
		y: source.y + offset,
	});
	return [...elements, copy];
}

// ---------------------------------------------------------------------------
// Z-order operations (array order = paint order: index 0 = back, last = front)
// ---------------------------------------------------------------------------

/**
 * Move the element with `id` to the end of the array (top/front in paint order).
 *
 * @example
 *   bringToFront(elements, 'el1')
 */
export function bringToFront(elements: readonly PptxElement[], id: string): PptxElement[] {
	const idx = elements.findIndex((el) => el.id === id);
	if (idx === -1 || idx === elements.length - 1) {
		return elements as PptxElement[];
	}
	const el = elements[idx];
	const rest = elements.filter((_, i) => i !== idx);
	return [...rest, el];
}

/**
 * Move the element with `id` to index 0 (bottom/back in paint order).
 *
 * @example
 *   sendToBack(elements, 'el1')
 */
export function sendToBack(elements: readonly PptxElement[], id: string): PptxElement[] {
	const idx = elements.findIndex((el) => el.id === id);
	if (idx === -1 || idx === 0) {
		return elements as PptxElement[];
	}
	const el = elements[idx];
	const rest = elements.filter((_, i) => i !== idx);
	return [el, ...rest];
}

/**
 * Swap the element with `id` with the element one position higher in the
 * array (one step toward the front/top).  No-op if already at the top.
 *
 * @example
 *   bringForward(elements, 'el1')
 */
export function bringForward(elements: readonly PptxElement[], id: string): PptxElement[] {
	const idx = elements.findIndex((el) => el.id === id);
	if (idx === -1 || idx === elements.length - 1) {
		return elements as PptxElement[];
	}
	const next = [...elements];
	const tmp = next[idx];
	next[idx] = next[idx + 1];
	next[idx + 1] = tmp;
	return next;
}

/**
 * Swap the element with `id` with the element one position lower in the
 * array (one step toward the back/bottom).  No-op if already at the bottom.
 *
 * @example
 *   sendBackward(elements, 'el1')
 */
export function sendBackward(elements: readonly PptxElement[], id: string): PptxElement[] {
	const idx = elements.findIndex((el) => el.id === id);
	if (idx === -1 || idx === 0) {
		return elements as PptxElement[];
	}
	const next = [...elements];
	const tmp = next[idx];
	next[idx] = next[idx - 1];
	next[idx - 1] = tmp;
	return next;
}
