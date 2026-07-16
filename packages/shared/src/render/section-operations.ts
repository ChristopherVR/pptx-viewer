/**
 * section-operations: Pure array-transformation functions for slide sections.
 *
 * Framework-agnostic (no framework imports). Each transform takes the current
 * `sections` and `slides` arrays and returns a NEW `{ sections, slides }` pair;
 * the inputs are never mutated. The React `useSectionOperations` hook and the
 * Vue `useSectionOperations` composable both wire their reactive state through
 * these transforms so the immutable section algorithms live in one place.
 *
 * Section ids are OOXML GUID-like strings. `addSection` generates one via the
 * supplied `idGenerator` (default {@link generateSectionId}), keeping the
 * transform overridable yet self-contained, matching the neighbouring shared
 * editor modules.
 */

import type { PptxSection, PptxSlide } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/** The updated `sections` + `slides` pair produced by a section transform. */
export interface SectionMutationResult {
	sections: PptxSection[];
	slides: PptxSlide[];
}

/** Minimum section metadata needed to build sidebar groups. */
export interface SectionGroupDescriptor {
	id: string;
	name: string;
	collapsed?: boolean;
	color?: string;
}

/** A declared section paired with its slides, or the trailing ungrouped slides. */
export interface SectionSlideGroup<TSection extends SectionGroupDescriptor = PptxSection> {
	section: TSection | undefined;
	slides: PptxSlide[];
	slideIndexes: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a GUID-like id that matches typical OOXML section ids, e.g.
 * `{1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d}`. Uses `Math.random` inside the
 * function body (called at runtime, never at module-eval time).
 */
export function generateSectionId(): string {
	const hex = (): string =>
		Math.floor(Math.random() * 0x10000)
			.toString(16)
			.padStart(4, '0');
	return `{${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}}`;
}

/**
 * Resolve the OOXML slide id used inside a section's `slideIds` list. Prefer the
 * raw `p:sld/@_id`, then the slide number, then a 1-based index fallback.
 */
export function resolveSlideId(slide: PptxSlide | undefined, index: number): string {
	const rawXml = slide?.rawXml as Record<string, unknown> | undefined;
	const cSld = rawXml?.['p:sld'] as Record<string, unknown> | undefined;
	return String(cSld?.['@_id'] || slide?.slideNumber || index + 1);
}

/**
 * Group slides in declared section order, followed by slides without a known
 * section. Empty declared sections are omitted, matching React's sidebar.
 */
export function groupSlidesBySection<TSection extends SectionGroupDescriptor>(
	sections: readonly TSection[],
	slides: readonly PptxSlide[],
): SectionSlideGroup<TSection>[] {
	if (slides.length === 0) {
		return [];
	}
	if (sections.length === 0) {
		return [
			{ section: undefined, slides: [...slides], slideIndexes: slides.map((_slide, i) => i) },
		];
	}

	const sectionById = new Map(sections.map((section) => [section.id, section]));
	const grouped = new Map<string, SectionSlideGroup<TSection>>();
	const ungrouped: SectionSlideGroup<TSection> = {
		section: undefined,
		slides: [],
		slideIndexes: [],
	};
	for (const section of sections) {
		grouped.set(section.id, { section, slides: [], slideIndexes: [] });
	}

	slides.forEach((slide, index) => {
		const group = slide.sectionId ? grouped.get(slide.sectionId) : undefined;
		const target = group && sectionById.has(slide.sectionId ?? '') ? group : ungrouped;
		target.slides.push(slide);
		target.slideIndexes.push(index);
	});

	const result = sections
		.map((section) => grouped.get(section.id)!)
		.filter((group) => group.slides.length > 0);
	if (ungrouped.slides.length > 0) {
		result.push(ungrouped);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Pure transforms
// ---------------------------------------------------------------------------

/**
 * Insert a new section after the slide at `afterSlideIndex`, claiming that
 * slide and the following contiguous run that shares its current section.
 *
 * @param idGenerator - Supplies the new section id (default {@link generateSectionId}).
 */
export function addSection(
	sections: readonly PptxSection[],
	slides: readonly PptxSlide[],
	name: string,
	afterSlideIndex: number,
	idGenerator: () => string = generateSectionId,
): SectionMutationResult {
	const newId = idGenerator();
	const slideAtIndex = slides[afterSlideIndex];
	const currentSectionId = slideAtIndex?.sectionId;

	// The new section claims slides starting at `afterSlideIndex` onward that
	// belong to the same current section, until the next different section.
	const claimedSlideIndexes: number[] = [];
	for (let i = afterSlideIndex; i < slides.length; i++) {
		if (i === afterSlideIndex || slides[i].sectionId === currentSectionId) {
			claimedSlideIndexes.push(i);
		} else {
			break;
		}
	}

	const nextSlides = slides.map((s, i) =>
		claimedSlideIndexes.includes(i) ? { ...s, sectionId: newId, sectionName: name } : s,
	);

	const insertIndex =
		currentSectionId !== undefined
			? sections.findIndex((sec) => sec.id === currentSectionId) + 1
			: sections.length;

	const newSectionSlideIds = claimedSlideIndexes.map((i) => resolveSlideId(slides[i], i));

	const updated = sections.map((sec) =>
		sec.id === currentSectionId
			? { ...sec, slideIds: sec.slideIds.filter((sid) => !newSectionSlideIds.includes(sid)) }
			: sec,
	);

	const newSection: PptxSection = { id: newId, name, slideIds: newSectionSlideIds };
	const nextSections = [...updated];
	nextSections.splice(insertIndex, 0, newSection);

	return { sections: nextSections, slides: nextSlides };
}

/** Rename a section and propagate the name to its slides. */
export function renameSection(
	sections: readonly PptxSection[],
	slides: readonly PptxSlide[],
	sectionId: string,
	newName: string,
): SectionMutationResult {
	return {
		sections: sections.map((sec) => (sec.id === sectionId ? { ...sec, name: newName } : sec)),
		slides: slides.map((s) => (s.sectionId === sectionId ? { ...s, sectionName: newName } : s)),
	};
}

/**
 * Remove a section, merging its slides into the previous section (or clearing
 * the section on its slides when it was the first one).
 */
export function deleteSection(
	sections: readonly PptxSection[],
	slides: readonly PptxSlide[],
	sectionId: string,
): SectionMutationResult {
	const idx = sections.findIndex((sec) => sec.id === sectionId);
	if (idx === -1) {
		return { sections: sections as PptxSection[], slides: slides as PptxSlide[] };
	}

	const deletedSection = sections[idx];
	const prevSection = idx > 0 ? sections[idx - 1] : undefined;

	const filtered = sections.filter((sec) => sec.id !== sectionId);
	const nextSections =
		prevSection !== undefined
			? filtered.map((sec) =>
					sec.id === prevSection.id
						? { ...sec, slideIds: [...sec.slideIds, ...deletedSection.slideIds] }
						: sec,
				)
			: filtered;

	const nextSlides = slides.map((s) => {
		if (s.sectionId !== sectionId) {
			return s;
		}
		if (prevSection !== undefined) {
			return { ...s, sectionId: prevSection.id, sectionName: prevSection.name };
		}
		return { ...s, sectionId: undefined, sectionName: undefined };
	});

	return { sections: nextSections, slides: nextSlides };
}

/** Move a section one position earlier in the list. No-op if already first. */
export function moveSectionUp(sections: readonly PptxSection[], sectionId: string): PptxSection[] {
	const idx = sections.findIndex((sec) => sec.id === sectionId);
	if (idx <= 0) {
		return sections as PptxSection[];
	}
	const next = [...sections];
	[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
	return next;
}

/** Move a section one position later in the list. No-op if already last. */
export function moveSectionDown(
	sections: readonly PptxSection[],
	sectionId: string,
): PptxSection[] {
	const idx = sections.findIndex((sec) => sec.id === sectionId);
	if (idx === -1 || idx >= sections.length - 1) {
		return sections as PptxSection[];
	}
	const next = [...sections];
	[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
	return next;
}

/**
 * Reassign the slides at `slideIndexes` to `targetSectionId`, removing them
 * from any other section's `slideIds`. No-op if the target section is unknown.
 */
export function moveSlidesToSection(
	sections: readonly PptxSection[],
	slides: readonly PptxSlide[],
	slideIndexes: readonly number[],
	targetSectionId: string,
): SectionMutationResult {
	const targetSection = sections.find((sec) => sec.id === targetSectionId);
	if (!targetSection) {
		return { sections: sections as PptxSection[], slides: slides as PptxSlide[] };
	}

	const nextSlides = slides.map((s, i) =>
		slideIndexes.includes(i)
			? { ...s, sectionId: targetSectionId, sectionName: targetSection.name }
			: s,
	);

	const movedSlideIds = slideIndexes.map((i) => resolveSlideId(slides[i], i));
	const nextSections = sections.map((sec) => {
		if (sec.id === targetSectionId) {
			return {
				...sec,
				slideIds: [...sec.slideIds, ...movedSlideIds.filter((sid) => !sec.slideIds.includes(sid))],
			};
		}
		return { ...sec, slideIds: sec.slideIds.filter((sid) => !movedSlideIds.includes(sid)) };
	});

	return { sections: nextSections, slides: nextSlides };
}
