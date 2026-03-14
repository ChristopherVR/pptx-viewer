/**
 * Presentation merge operations for the headless PPTX SDK.
 *
 * Merges slides from a source presentation into a target at the
 * {@link PptxData} level. Media embedded as data URLs (imageData,
 * mediaData, backgroundImage, posterFrameData) travel with elements
 * automatically — no ZIP-level copying is needed.
 *
 * @module sdk/merge-operations
 */

import type { PptxData, PptxSlide } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import { cloneSlide } from "../../utils/clone-utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options controlling how slides are merged from source into target.
 */
export interface MergeOptions {
	/** Which slides to take from source (0-based indices). Default: all */
	slideIndices?: number[];
	/** Where to insert in target (0-based). Default: end */
	insertAt?: number;
	/** Whether to keep source theme (false = use target theme). Default: false */
	keepSourceTheme?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Collect all element IDs from a slide, including nested group children.
 */
function collectElementIds(elements: PptxElement[]): Set<string> {
	const ids = new Set<string>();
	for (const el of elements) {
		ids.add(el.id);
		if (el.type === "group" && el.children) {
			for (const childId of collectElementIds(el.children)) {
				ids.add(childId);
			}
		}
	}
	return ids;
}

/**
 * Collect all slide IDs from a set of slides.
 */
function collectSlideIds(slides: PptxSlide[]): Set<string> {
	const ids = new Set<string>();
	for (const slide of slides) {
		ids.add(slide.id);
	}
	return ids;
}

/**
 * Collect all relationship IDs from a set of slides.
 */
function collectSlideRIds(slides: PptxSlide[]): Set<string> {
	const ids = new Set<string>();
	for (const slide of slides) {
		ids.add(slide.rId);
	}
	return ids;
}

/**
 * Collect every element ID across all slides (for conflict detection).
 */
function collectAllElementIds(slides: PptxSlide[]): Set<string> {
	const ids = new Set<string>();
	for (const slide of slides) {
		for (const id of collectElementIds(slide.elements)) {
			ids.add(id);
		}
	}
	return ids;
}

/**
 * Generate a unique slide ID that doesn't conflict with existing ones.
 */
function uniqueSlideId(base: string, existing: Set<string>): string {
	if (!existing.has(base)) return base;
	let counter = 1;
	let candidate = `${base}_m${counter}`;
	while (existing.has(candidate)) {
		counter++;
		candidate = `${base}_m${counter}`;
	}
	return candidate;
}

/**
 * Generate a unique relationship ID that doesn't conflict with existing ones.
 */
function uniqueRId(existing: Set<string>, startIdx: number): string {
	let idx = startIdx;
	let candidate = `rId${idx}`;
	while (existing.has(candidate)) {
		idx++;
		candidate = `rId${idx}`;
	}
	return candidate;
}

/**
 * Re-map element IDs on a single element tree to avoid conflicts.
 * Returns a map from old ID to new ID.
 */
function remapElementIds(
	elements: PptxElement[],
	existingIds: Set<string>,
	idMap: Map<string, string>,
): void {
	for (const el of elements) {
		if (existingIds.has(el.id)) {
			const newId = generateUniqueElementId(el.id, existingIds);
			idMap.set(el.id, newId);
			el.id = newId;
			existingIds.add(newId);
		} else {
			existingIds.add(el.id);
		}
		if (el.type === "group" && el.children) {
			remapElementIds(el.children, existingIds, idMap);
		}
	}
}

/**
 * Generate a unique element ID that doesn't conflict.
 */
function generateUniqueElementId(
	base: string,
	existing: Set<string>,
): string {
	let counter = 1;
	let candidate = `${base}_m${counter}`;
	while (existing.has(candidate)) {
		counter++;
		candidate = `${base}_m${counter}`;
	}
	return candidate;
}

/**
 * Update connector references after element ID remapping.
 * Connectors may reference shape IDs in their start/end connections.
 */
function updateConnectorReferences(
	elements: PptxElement[],
	idMap: Map<string, string>,
): void {
	for (const el of elements) {
		if (el.type === "connector" && el.shapeStyle) {
			const style = el.shapeStyle;
			if (style.connectorStartConnection?.shapeId) {
				const newId = idMap.get(style.connectorStartConnection.shapeId);
				if (newId) {
					style.connectorStartConnection.shapeId = newId;
				}
			}
			if (style.connectorEndConnection?.shapeId) {
				const newId = idMap.get(style.connectorEndConnection.shapeId);
				if (newId) {
					style.connectorEndConnection.shapeId = newId;
				}
			}
		}
		if (el.type === "group" && el.children) {
			updateConnectorReferences(el.children, idMap);
		}
	}
}

/**
 * Update animation element references after ID remapping.
 */
function updateAnimationReferences(
	slide: PptxSlide,
	idMap: Map<string, string>,
): void {
	if (slide.animations) {
		for (const anim of slide.animations) {
			const newId = idMap.get(anim.elementId);
			if (newId) {
				anim.elementId = newId;
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Main merge function
// ---------------------------------------------------------------------------

/**
 * Merge slides from a source presentation into a target.
 *
 * This is a data-level merge that operates on {@link PptxData} objects.
 * Slides are deep-cloned from the source, re-numbered to avoid ID
 * conflicts, and inserted into the target's slides array.
 *
 * Media embedded as data URLs (imageData, mediaData, backgroundImage,
 * posterFrameData) travel with the cloned elements automatically.
 *
 * @param targetData - The target presentation data (will be modified in place).
 * @param sourceData - The source presentation data (read-only — slides are cloned).
 * @param options - Merge configuration.
 * @returns Number of slides merged.
 *
 * @example
 * ```ts
 * const target = await handler.load(targetBuffer);
 * const source = await handler.load(sourceBuffer);
 *
 * const count = mergePresentation(target, source, {
 *   slideIndices: [0, 2],
 *   insertAt: 1,
 * });
 * console.log(`Merged ${count} slides`);
 * ```
 */
export function mergePresentation(
	targetData: PptxData,
	sourceData: PptxData,
	options?: MergeOptions,
): number {
	// Determine which source slides to merge
	const indices = options?.slideIndices ?? sourceData.slides.map((_, i) => i);

	// Filter valid indices
	const validIndices = indices.filter(
		(i) => i >= 0 && i < sourceData.slides.length,
	);

	if (validIndices.length === 0) {
		return 0;
	}

	// Clone selected slides from source
	const clonedSlides: PptxSlide[] = validIndices.map((i) =>
		cloneSlide(sourceData.slides[i]),
	);

	// Collect existing IDs in target
	const existingSlideIds = collectSlideIds(targetData.slides);
	const existingRIds = collectSlideRIds(targetData.slides);
	const existingElementIds = collectAllElementIds(targetData.slides);

	// Determine insertion point
	const insertAt = Math.min(
		Math.max(0, options?.insertAt ?? targetData.slides.length),
		targetData.slides.length,
	);

	// Re-number cloned slides to avoid conflicts
	let nextRIdNum = targetData.slides.length + 2; // rId numbering typically starts at rId2 for slides
	for (const slide of clonedSlides) {
		// Re-assign slide ID
		const newSlideId = uniqueSlideId(slide.id, existingSlideIds);
		existingSlideIds.add(newSlideId);
		slide.id = newSlideId;

		// Re-assign relationship ID
		const newRId = uniqueRId(existingRIds, nextRIdNum);
		existingRIds.add(newRId);
		slide.rId = newRId;
		nextRIdNum++;

		// Re-map element IDs to avoid conflicts
		const idMap = new Map<string, string>();
		remapElementIds(slide.elements, existingElementIds, idMap);

		// Update connector references using the ID map
		if (idMap.size > 0) {
			updateConnectorReferences(slide.elements, idMap);
			updateAnimationReferences(slide, idMap);
		}

		// Mark slide as dirty so save will re-serialize it
		slide.isDirty = true;
	}

	// Insert cloned slides at the specified position
	targetData.slides.splice(insertAt, 0, ...clonedSlides);

	// Re-number all slide numbers (1-based) to maintain consistency
	for (let i = 0; i < targetData.slides.length; i++) {
		targetData.slides[i].slideNumber = i + 1;
	}

	// Optionally merge theme colors from source
	if (options?.keepSourceTheme && sourceData.themeColorMap) {
		targetData.themeColorMap = { ...sourceData.themeColorMap };
		if (sourceData.theme) {
			targetData.theme = JSON.parse(JSON.stringify(sourceData.theme));
		}
	}

	return clonedSlides.length;
}
