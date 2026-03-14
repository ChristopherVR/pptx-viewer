/**
 * Slide cloning operations for the headless PPTX SDK.
 *
 * Provides deep-clone functionality that creates fully independent
 * slide copies with new element IDs so they can safely coexist
 * in the same presentation.
 *
 * @module sdk/slide-operations
 */

import type { PptxSlide } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import {
	cloneSlide as cloneSlideDeep,
	cloneElement as cloneElementDeep,
} from "../../utils/clone-utils";

// ---------------------------------------------------------------------------
// ID re-assignment helpers
// ---------------------------------------------------------------------------

let cloneIdCounter = 0;

function generateCloneId(prefix: string): string {
	cloneIdCounter += 1;
	return `${prefix}_clone_${Date.now().toString(36)}_${cloneIdCounter}`;
}

/** Reset the clone ID counter (useful for tests). */
export function resetCloneIdCounter(): void {
	cloneIdCounter = 0;
}

/**
 * Re-assign unique IDs to an element. For group elements, recursively
 * re-assigns IDs to all children.
 */
function reassignElementId(element: PptxElement): PptxElement {
	const prefix = element.type === "text"
		? "txt"
		: element.type === "shape"
			? "shp"
			: element.type === "connector"
				? "cxn"
				: element.type === "image" || element.type === "picture"
					? "img"
					: element.type === "table"
						? "tbl"
						: element.type === "chart"
							? "cht"
							: element.type === "media"
								? "med"
								: element.type === "group"
									? "grp"
									: element.type;

	const newElement = { ...element, id: generateCloneId(prefix) };

	// Recursively handle group children
	if (newElement.type === "group" && "children" in newElement) {
		(newElement as PptxElement & { children: PptxElement[] }).children =
			(newElement as PptxElement & { children: PptxElement[] }).children.map(
				(child) => reassignElementId(child),
			);
	}

	return newElement;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deep-clone a slide, assigning new unique IDs to the clone and all
 * its elements (including nested group children).
 *
 * Uses the existing `cloneSlide` from clone-utils for deep copying,
 * then re-assigns IDs so the cloned slide is fully independent.
 *
 * @param slide - The source slide to clone.
 * @param newSlideNumber - The 1-based slide number for the clone.
 * @returns A fully independent copy with new IDs.
 *
 * @example
 * ```ts
 * const cloned = duplicateSlide(data.slides[0], data.slides.length + 1);
 * data.slides.push(cloned);
 * ```
 */
export function duplicateSlide(
	slide: PptxSlide,
	newSlideNumber: number,
): PptxSlide {
	// Deep-clone the slide to break all shared references
	const cloned = cloneSlideDeep(slide);

	// Assign new slide identity
	cloned.id = `slide${newSlideNumber}`;
	cloned.rId = `rId${newSlideNumber + 1}`;
	cloned.slideNumber = newSlideNumber;

	// Re-assign IDs to all elements so they don't collide
	cloned.elements = cloned.elements.map(reassignElementId);

	// Update animation element references to use the new IDs
	if (cloned.animations && cloned.animations.length > 0) {
		const idMap = new Map<string, string>();
		slide.elements.forEach((originalEl, idx) => {
			if (idx < cloned.elements.length) {
				idMap.set(originalEl.id, cloned.elements[idx].id);
			}
		});

		cloned.animations = cloned.animations.map((anim) => ({
			...anim,
			elementId: idMap.get(anim.elementId) ?? anim.elementId,
		}));
	}

	return cloned;
}

/**
 * Deep-clone a single element with a new unique ID.
 *
 * For group elements, all children are recursively cloned and
 * receive new IDs as well.
 *
 * @param element - The element to clone.
 * @returns A fully independent copy with a new ID.
 */
export function duplicateElement(element: PptxElement): PptxElement {
	const cloned = cloneElementDeep(element);
	return reassignElementId(cloned);
}
