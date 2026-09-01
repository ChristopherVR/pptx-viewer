/**
 * Generic "patch matching ids, recurse into groups" element-tree walker.
 *
 * Every load pipeline in this codebase resolves some lazily-loaded field
 * (a picture's Blob URL, a media poster frame, a table cell's image fill)
 * against a path -> URL map, then needs to splice the result back into the
 * immutable slide-element tree, recursing into `group` children, and
 * preserving array/object identity for any branch nothing changed in (so a
 * caller can skip a state update exactly like a no-op). React, Vue, Angular,
 * Svelte and Vanilla's `useLoadContent` (and this module's own
 * `applyTableCellImagePatches`) each hand-rolled an identical closure to do
 * this; this is the one copy.
 *
 * @module loader/element-patch-walker
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { ImagePathElement } from './load-content-helpers';

/**
 * Applied to every element in the tree. Return the SAME element instance when
 * nothing about it changes; {@link walkAndPatchElements} compares by
 * reference to decide whether a branch (and, transitively, its ancestors)
 * needs to be rebuilt.
 */
export type ElementPatcher = (element: PptxElement) => PptxElement;

/**
 * Recursively walk an element tree, applying `patch` to every element and
 * recursing into `group` children. Rebuilds only the branches that actually
 * changed (by reference); returns the SAME `elements` array reference when
 * `patch` changed nothing anywhere in the tree.
 */
export function walkAndPatchElements(
	elements: PptxElement[],
	patch: ElementPatcher,
): PptxElement[] {
	let mutated = false;
	const next = elements.map((el) => {
		let updated = patch(el);
		if (updated.type === 'group' && updated.children?.length) {
			const newChildren = walkAndPatchElements(updated.children, patch);
			if (newChildren !== updated.children) {
				updated = { ...updated, children: newChildren };
			}
		}
		if (updated !== el) {
			mutated = true;
		}
		return updated;
	});
	return mutated ? next : elements;
}

/**
 * Apply resolved flat-field image URLs (from {@link collectImagePaths} in
 * `load-content-helpers.ts` plus a path -> URL map) back onto the element
 * tree, immutably, via {@link walkAndPatchElements}. Mirrors
 * {@link applyTableCellImagePatches}'s "return the same reference when
 * nothing resolved" contract.
 */
export function applyImagePathPatches(
	elements: PptxElement[],
	resolvedMap: Map<string, string>,
	refs: readonly ImagePathElement[],
): PptxElement[] {
	const elementPatches = new Map<string, Record<string, string>>();
	for (const ref of refs) {
		const url = resolvedMap.get(ref.path);
		if (!url) {
			continue;
		}
		const existing = elementPatches.get(ref.element.id) ?? {};
		existing[ref.field] = url;
		elementPatches.set(ref.element.id, existing);
	}
	if (elementPatches.size === 0) {
		return elements;
	}

	return walkAndPatchElements(elements, (el) => {
		const patch = elementPatches.get(el.id);
		return patch ? ({ ...el, ...patch } as PptxElement) : el;
	});
}
