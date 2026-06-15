import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * `useSectionOperations` — CRUD + grouping for slide sections in the Vue editor.
 *
 * Vue port of the React `useSectionOperations` hook (`packages/react/src/
 * viewer/hooks/useSectionOperations.ts`). It mirrors that hook's operation set
 * and semantics:
 *
 *  - `addSection` — insert a new section after a slide, claiming the run of
 *    contiguous slides that share the slide's current section.
 *  - `renameSection` — rename a section and propagate the name to its slides.
 *  - `deleteSection` — remove a section, merging its slides into the previous
 *    section (or clearing the section on its slides when it was the first).
 *  - `moveSectionUp` / `moveSectionDown` — reorder a section by one position.
 *  - `moveSlidesToSection` — reassign a set of slides (by index) to a section.
 *  - `toggleSectionCollapse` — flip the `collapsed` flag on a section.
 *  - `slidesBySection` — a computed grouping of slides keyed by their section.
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
export interface SectionGroup {
	/** The owning section, or `undefined` for the leading no-section group. */
	section: PptxSection | undefined;
	/** Slides (in deck order) that belong to this group. */
	slides: PptxSlide[];
	/** 0-based indices into the slide list for each slide in this group. */
	slideIndexes: number[];
}

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
// Helpers
// ---------------------------------------------------------------------------

/** Generate a GUID-like id matching typical OOXML section ids. */
function generateSectionId(): string {
	const hex = (): string =>
		Math.floor(Math.random() * 0x10000)
			.toString(16)
			.padStart(4, '0');
	return `{${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}}`;
}

/**
 * Resolve the OOXML slide id used inside a section's `slideIds` list. Mirrors
 * the React hook: prefer the raw `p:sld/@_id`, then the slide number, then a
 * 1-based index fallback.
 */
function resolveSlideId(slide: PptxSlide | undefined, index: number): string {
	const rawXml = slide?.rawXml as Record<string, unknown> | undefined;
	const cSld = rawXml?.['p:sld'] as Record<string, unknown> | undefined;
	return String(cSld?.['@_id'] || slide?.slideNumber || index + 1);
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

		const slideList = slides.value;
		const slideAtIndex = slideList[afterSlideIndex];
		const currentSectionId = slideAtIndex?.sectionId;
		const newId = generateSectionId();

		// The new section claims slides starting at `afterSlideIndex` onward that
		// belong to the same current section, until the next different section.
		const claimedSlideIndexes: number[] = [];
		for (let i = afterSlideIndex; i < slideList.length; i++) {
			if (i === afterSlideIndex || slideList[i].sectionId === currentSectionId) {
				claimedSlideIndexes.push(i);
			} else {
				break;
			}
		}

		// Reassign claimed slides to the new section.
		slides.value = slideList.map((s, i) =>
			claimedSlideIndexes.includes(i) ? { ...s, sectionId: newId, sectionName: name } : s,
		);

		// Insert the new section after the current section, moving the claimed
		// slide ids out of the old section and into the new one.
		const insertIndex =
			currentSectionId !== undefined
				? sections.value.findIndex((sec) => sec.id === currentSectionId) + 1
				: sections.value.length;

		const newSectionSlideIds = claimedSlideIndexes.map((i) => resolveSlideId(slideList[i], i));

		const updated = sections.value.map((sec) =>
			sec.id === currentSectionId
				? { ...sec, slideIds: sec.slideIds.filter((sid) => !newSectionSlideIds.includes(sid)) }
				: sec,
		);

		const newSection: PptxSection = { id: newId, name, slideIds: newSectionSlideIds };
		const result = [...updated];
		result.splice(insertIndex, 0, newSection);
		sections.value = result;
	};

	const renameSection = (sectionId: string, newName: string): void => {
		pushHistory();
		sections.value = sections.value.map((sec) =>
			sec.id === sectionId ? { ...sec, name: newName } : sec,
		);
		slides.value = slides.value.map((s) =>
			s.sectionId === sectionId ? { ...s, sectionName: newName } : s,
		);
	};

	const deleteSection = (sectionId: string): void => {
		const current = sections.value;
		const idx = current.findIndex((sec) => sec.id === sectionId);
		if (idx === -1) {
			return;
		}
		pushHistory();

		const deletedSection = current[idx];
		const prevSection = idx > 0 ? current[idx - 1] : undefined;

		const filtered = current.filter((sec) => sec.id !== sectionId);
		sections.value =
			prevSection !== undefined
				? filtered.map((sec) =>
						sec.id === prevSection.id
							? { ...sec, slideIds: [...sec.slideIds, ...deletedSection.slideIds] }
							: sec,
					)
				: filtered;

		// Move the deleted section's slides to the previous section, or clear them.
		slides.value = slides.value.map((s) => {
			if (s.sectionId !== sectionId) {
				return s;
			}
			if (prevSection !== undefined) {
				return { ...s, sectionId: prevSection.id, sectionName: prevSection.name };
			}
			return { ...s, sectionId: undefined, sectionName: undefined };
		});
	};

	const moveSectionUp = (sectionId: string): void => {
		const current = sections.value;
		const idx = current.findIndex((sec) => sec.id === sectionId);
		if (idx <= 0) {
			return;
		}
		pushHistory();
		const next = [...current];
		[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
		sections.value = next;
	};

	const moveSectionDown = (sectionId: string): void => {
		const current = sections.value;
		const idx = current.findIndex((sec) => sec.id === sectionId);
		if (idx === -1 || idx >= current.length - 1) {
			return;
		}
		pushHistory();
		const next = [...current];
		[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
		sections.value = next;
	};

	const moveSlidesToSection = (slideIndexes: number[], targetSectionId: string): void => {
		const targetSection = sections.value.find((sec) => sec.id === targetSectionId);
		if (!targetSection) {
			return;
		}
		pushHistory();

		const slideList = slides.value;
		slides.value = slideList.map((s, i) =>
			slideIndexes.includes(i)
				? { ...s, sectionId: targetSectionId, sectionName: targetSection.name }
				: s,
		);

		const movedSlideIds = slideIndexes.map((i) => resolveSlideId(slideList[i], i));
		sections.value = sections.value.map((sec) => {
			if (sec.id === targetSectionId) {
				return {
					...sec,
					slideIds: [
						...sec.slideIds,
						...movedSlideIds.filter((sid) => !sec.slideIds.includes(sid)),
					],
				};
			}
			return { ...sec, slideIds: sec.slideIds.filter((sid) => !movedSlideIds.includes(sid)) };
		});
	};

	const toggleSectionCollapse = (sectionId: string): void => {
		sections.value = sections.value.map((sec) =>
			sec.id === sectionId ? { ...sec, collapsed: !sec.collapsed } : sec,
		);
	};

	const slidesBySection = computed<SectionGroup[]>(() => {
		const sectionById = new Map<string, PptxSection>();
		for (const sec of sections.value) {
			sectionById.set(sec.id, sec);
		}

		const groups: SectionGroup[] = [];
		let currentGroup: SectionGroup | undefined;

		slides.value.forEach((slide, index) => {
			const section = slide.sectionId !== undefined ? sectionById.get(slide.sectionId) : undefined;
			const groupSection = currentGroup?.section;
			const sameGroup =
				currentGroup !== undefined &&
				(groupSection?.id ?? undefined) === (section?.id ?? undefined);

			if (!sameGroup) {
				currentGroup = { section, slides: [], slideIndexes: [] };
				groups.push(currentGroup);
			}
			currentGroup!.slides.push(slide);
			currentGroup!.slideIndexes.push(index);
		});

		return groups;
	});

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
