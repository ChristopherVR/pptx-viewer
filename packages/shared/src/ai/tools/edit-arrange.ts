/**
 * Pure alignment and z-order helpers used by the `arrange_elements` tool. Kept
 * in their own module so `edit-tools.ts` stays within the per-file size budget.
 */

import type { PptxElement } from 'pptx-viewer-core';

/** Align a set of elements along one edge or centre axis (in place). */
export function alignElements(
	elements: PptxElement[],
	ids: Set<string>,
	alignment: string | undefined,
): void {
	const targets = elements.filter((e) => ids.has(e.id));
	if (targets.length === 0) {
		throw new Error('No matching elements to align.');
	}
	const set = (fn: (e: PptxElement) => void): void => targets.forEach(fn);
	switch (alignment) {
		case 'left': {
			const v = Math.min(...targets.map((e) => e.x));
			set((e) => (e.x = v));
			break;
		}
		case 'right': {
			const v = Math.max(...targets.map((e) => e.x + e.width));
			set((e) => (e.x = v - e.width));
			break;
		}
		case 'top': {
			const v = Math.min(...targets.map((e) => e.y));
			set((e) => (e.y = v));
			break;
		}
		case 'bottom': {
			const v = Math.max(...targets.map((e) => e.y + e.height));
			set((e) => (e.y = v - e.height));
			break;
		}
		case 'centerH': {
			const v = targets.reduce((s, e) => s + e.x + e.width / 2, 0) / targets.length;
			set((e) => (e.x = v - e.width / 2));
			break;
		}
		case 'centerV': {
			const v = targets.reduce((s, e) => s + e.y + e.height / 2, 0) / targets.length;
			set((e) => (e.y = v - e.height / 2));
			break;
		}
		default:
			throw new Error(`Unknown alignment: ${String(alignment)}`);
	}
}

/** Move one element within the z-stack (in place). */
export function reorderLayer(
	elements: PptxElement[],
	elementId: string | undefined,
	action: string | undefined,
): void {
	const idx = elements.findIndex((e) => e.id === elementId);
	if (idx < 0) {
		throw new Error(`Element '${String(elementId)}' not found.`);
	}
	const [el] = elements.splice(idx, 1);
	switch (action) {
		case 'bringToFront':
			elements.push(el);
			break;
		case 'sendToBack':
			elements.unshift(el);
			break;
		case 'bringForward':
			elements.splice(Math.min(idx + 1, elements.length), 0, el);
			break;
		case 'sendBackward':
			elements.splice(Math.max(idx - 1, 0), 0, el);
			break;
		default:
			elements.splice(idx, 0, el);
			throw new Error(`Unknown layerAction: ${String(action)}`);
	}
}
