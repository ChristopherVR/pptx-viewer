/**
 * Section management operations for the headless PPTX SDK.
 *
 * Provides pure functions for adding, removing, and reordering
 * sections within a {@link PptxData} structure. Sections group
 * consecutive slides under named headings (visible in the
 * PowerPoint slide sorter).
 *
 * @module sdk/section-operations
 */

import type { PptxData, PptxSection } from "../../types/presentation";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let sectionIdCounter = 0;

function generateSectionId(): string {
	sectionIdCounter += 1;
	return `sec_${Date.now().toString(36)}_${sectionIdCounter}`;
}

/** Reset the section ID counter (useful for tests). */
export function resetSectionIdCounter(): void {
	sectionIdCounter = 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a new section to the presentation.
 *
 * Creates a section that groups the specified slides together.
 * The slide indices are converted to slide IDs based on the
 * current slide order in `data.slides`.
 *
 * @param data - The presentation data to modify.
 * @param name - Display name for the section.
 * @param slideIndices - 0-based indices of slides to include.
 * @returns The created section.
 *
 * @example
 * ```ts
 * const section = addSection(data, "Introduction", [0, 1, 2]);
 * console.log(section.id); // => "sec_..."
 * ```
 */
export function addSection(
	data: PptxData,
	name: string,
	slideIndices: number[],
): PptxSection {
	if (!data.sections) {
		data.sections = [];
	}

	const sectionId = generateSectionId();

	// Map slide indices to slide IDs
	const slideIds = slideIndices
		.filter((idx) => idx >= 0 && idx < data.slides.length)
		.map((idx) => data.slides[idx].id);

	const section: PptxSection = {
		id: sectionId,
		name,
		slideIds,
	};

	data.sections.push(section);

	// Also update section references on the slides themselves
	for (const idx of slideIndices) {
		if (idx >= 0 && idx < data.slides.length) {
			data.slides[idx].sectionName = name;
			data.slides[idx].sectionId = sectionId;
		}
	}

	return section;
}

/**
 * Remove a section from the presentation by its ID.
 *
 * Clears section references on slides that belonged to the
 * removed section. Does nothing if the section ID is not found.
 *
 * @param data - The presentation data to modify.
 * @param sectionId - The section ID to remove.
 * @returns `true` if the section was found and removed.
 *
 * @example
 * ```ts
 * const removed = removeSection(data, "sec_abc123");
 * console.log(removed); // => true
 * ```
 */
export function removeSection(data: PptxData, sectionId: string): boolean {
	if (!data.sections) return false;

	const sectionIndex = data.sections.findIndex((s) => s.id === sectionId);
	if (sectionIndex === -1) return false;

	// Clear section references on slides that belonged to this section
	for (const slide of data.slides) {
		if (slide.sectionId === sectionId) {
			slide.sectionName = undefined;
			slide.sectionId = undefined;
		}
	}

	data.sections.splice(sectionIndex, 1);
	return true;
}

/**
 * Reorder sections in the presentation.
 *
 * The `sectionIds` array defines the new order. Section IDs not
 * present in the array are dropped. IDs that don't match existing
 * sections are silently ignored.
 *
 * @param data - The presentation data to modify.
 * @param sectionIds - Ordered array of section IDs defining the new order.
 *
 * @example
 * ```ts
 * reorderSections(data, ["sec_3", "sec_1", "sec_2"]);
 * console.log(data.sections?.map(s => s.name));
 * // => ["Conclusion", "Introduction", "Body"]
 * ```
 */
export function reorderSections(
	data: PptxData,
	sectionIds: string[],
): void {
	if (!data.sections) return;

	const sectionMap = new Map<string, PptxSection>();
	for (const section of data.sections) {
		sectionMap.set(section.id, section);
	}

	const reordered: PptxSection[] = [];
	for (const id of sectionIds) {
		const section = sectionMap.get(id);
		if (section) {
			reordered.push(section);
		}
	}

	data.sections = reordered;
}

/**
 * Get the section that a slide belongs to, if any.
 *
 * @param data - The presentation data.
 * @param slideIndex - 0-based slide index.
 * @returns The section the slide belongs to, or `undefined`.
 */
export function getSectionForSlide(
	data: PptxData,
	slideIndex: number,
): PptxSection | undefined {
	if (!data.sections || slideIndex < 0 || slideIndex >= data.slides.length) {
		return undefined;
	}

	const slide = data.slides[slideIndex];
	if (!slide.sectionId) return undefined;

	return data.sections.find((s) => s.id === slide.sectionId);
}

/**
 * Move slides between sections.
 *
 * Removes the specified slides from their current section (if any)
 * and adds them to the target section.
 *
 * @param data - The presentation data to modify.
 * @param slideIndices - 0-based indices of slides to move.
 * @param targetSectionId - The section ID to move slides to.
 * @returns `true` if the target section was found and slides were moved.
 */
export function moveSlidesToSection(
	data: PptxData,
	slideIndices: number[],
	targetSectionId: string,
): boolean {
	if (!data.sections) return false;

	const targetSection = data.sections.find((s) => s.id === targetSectionId);
	if (!targetSection) return false;

	for (const idx of slideIndices) {
		if (idx < 0 || idx >= data.slides.length) continue;

		const slide = data.slides[idx];

		// Remove from current section's slideIds
		if (slide.sectionId) {
			const currentSection = data.sections.find(
				(s) => s.id === slide.sectionId,
			);
			if (currentSection) {
				currentSection.slideIds = currentSection.slideIds.filter(
					(id) => id !== slide.id,
				);
			}
		}

		// Add to target section
		if (!targetSection.slideIds.includes(slide.id)) {
			targetSection.slideIds.push(slide.id);
		}

		// Update slide references
		slide.sectionName = targetSection.name;
		slide.sectionId = targetSection.id;
	}

	return true;
}
