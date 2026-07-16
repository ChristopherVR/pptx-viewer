import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import {
	addSection as addSectionTransform,
	deleteSection as deleteSectionTransform,
	groupSlidesBySection,
	moveSectionDown as moveSectionDownTransform,
	moveSectionUp as moveSectionUpTransform,
	moveSlidesToSection as moveSlidesToSectionTransform,
	renameSection as renameSectionTransform,
} from 'pptx-viewer-shared';
import type { SectionSlideGroup } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * `useSectionOperations`: CRUD + grouping for slide sections in the Vue editor.
 *
 * Vue port of the React `useSectionOperations` hook (`packages/react/src/
 * viewer/hooks/useSectionOperations.ts`). It mirrors that hook's operation set
 * and semantics:
 *
 *  - `addSection`: insert a new section after a slide, claiming the run of
 *    contiguous slides that share the slide's current section.
 *  - `renameSection`: rename a section and propagate the name to its slides.
 *  - `deleteSection`: remove a section, merging its slides into the previous
 *    section (or clearing the section on its slides when it was the first).
 *  - `moveSectionUp` / `moveSectionDown`: reorder a section by one position.
 *  - `moveSlidesToSection`: reassign a set of slides (by index) to a section.
 *  - `toggleSectionCollapse`: flip the `collapsed` flag on a section.
 *  - `slidesBySection`: a computed grouping of slides keyed by their section.
 *
 * The composable is DOM-free and operates purely on the reactive model so it is
 * unit-testable in isolation. Each mutating operation snapshots undo/redo
 * history *first* (via the supplied `pushHistory`, the Vue equivalent of the
 * React hook's `markDirty`) and then reassigns `sections.value` / `slides.value`
 * with fresh arrays so `shallowRef`-backed state triggers reactivity.
 */

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export interface UseSectionOperationsInput {
	/** Reactive section list (typically a `shallowRef<PptxSection[]>`). */
	sections: Ref<PptxSection[]>;
	/** Reactive slide list (typically a `shallowRef<PptxSlide[]>`). */
	slides: Ref<PptxSlide[]>;
	/** Index of the currently focused slide. */
	activeSlideIndex: Ref<number>;
	/** Snapshot current state onto the undo stack before mutating. */
	pushHistory: () => void;
}

/** A section paired with the ordered slides that belong to it. */
export type SectionGroup = SectionSlideGroup<PptxSection>;

export interface UseSectionOperationsResult {
	/**
	 * Insert a new section after the slide at `afterSlideIndex`, claiming that
	 * slide and the following contiguous run that shares its current section.
	 */
	addSection: (name: string, afterSlideIndex: number) => void;
	/** Rename a section and propagate the name to its slides. */
	renameSection: (sectionId: string, newName: string) => void;
	/** Remove a section, merging its slides into the previous section. */
	deleteSection: (sectionId: string) => void;
	/** Move a section one position earlier in the list. */
	moveSectionUp: (sectionId: string) => void;
	/** Move a section one position later in the list. */
	moveSectionDown: (sectionId: string) => void;
	/** Reassign the slides at `slideIndexes` to the target section. */
	moveSlidesToSection: (slideIndexes: number[], targetSectionId: string) => void;
	/** Flip the `collapsed` flag on a section. */
	toggleSectionCollapse: (sectionId: string) => void;
	/** Slides grouped by section, in deck order (leading no-section group first). */
	slidesBySection: ComputedRef<SectionGroup[]>;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useSectionOperations(input: UseSectionOperationsInput): UseSectionOperationsResult {
	const { sections, slides, activeSlideIndex: _activeSlideIndex, pushHistory } = input;
	// `activeSlideIndex` is accepted for parity with the slide-operations
	// contract (and to support future "add section at the active slide" UI
	// shortcuts); the operations themselves take explicit indices.
	void _activeSlideIndex;

	const addSection = (name: string, afterSlideIndex: number): void => {
		pushHistory();
		const result = addSectionTransform(sections.value, slides.value, name, afterSlideIndex);
		slides.value = result.slides;
		sections.value = result.sections;
	};

	const renameSection = (sectionId: string, newName: string): void => {
		pushHistory();
		const result = renameSectionTransform(sections.value, slides.value, sectionId, newName);
		sections.value = result.sections;
		slides.value = result.slides;
	};

	const deleteSection = (sectionId: string): void => {
		if (sections.value.findIndex((sec) => sec.id === sectionId) === -1) {
			return;
		}
		pushHistory();
		const result = deleteSectionTransform(sections.value, slides.value, sectionId);
		sections.value = result.sections;
		slides.value = result.slides;
	};

	const moveSectionUp = (sectionId: string): void => {
		const current = sections.value;
		const idx = current.findIndex((sec) => sec.id === sectionId);
		if (idx <= 0) {
			return;
		}
		pushHistory();
		sections.value = moveSectionUpTransform(current, sectionId);
	};

	const moveSectionDown = (sectionId: string): void => {
		const current = sections.value;
		const idx = current.findIndex((sec) => sec.id === sectionId);
		if (idx === -1 || idx >= current.length - 1) {
			return;
		}
		pushHistory();
		sections.value = moveSectionDownTransform(current, sectionId);
	};

	const moveSlidesToSection = (slideIndexes: number[], targetSectionId: string): void => {
		if (!sections.value.some((sec) => sec.id === targetSectionId)) {
			return;
		}
		pushHistory();
		const result = moveSlidesToSectionTransform(
			sections.value,
			slides.value,
			slideIndexes,
			targetSectionId,
		);
		slides.value = result.slides;
		sections.value = result.sections;
	};

	const toggleSectionCollapse = (sectionId: string): void => {
		sections.value = sections.value.map((sec) =>
			sec.id === sectionId ? { ...sec, collapsed: !sec.collapsed } : sec,
		);
	};

	const slidesBySection = computed<SectionGroup[]>(() =>
		groupSlidesBySection(sections.value, slides.value),
	);

	return {
		addSection,
		renameSection,
		deleteSection,
		moveSectionUp,
		moveSectionDown,
		moveSlidesToSection,
		toggleSectionCollapse,
		slidesBySection,
	};
}
