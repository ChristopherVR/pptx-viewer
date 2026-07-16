import {
	addSection,
	deleteSection,
	moveSectionDown,
	moveSectionUp,
	moveSlidesToSection,
	renameSection,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

/** History-aware slide section actions exposed to the rail and Home ribbon. */
export interface SectionActions {
	addSection(name: string, afterSlideIndex?: number): string | null;
	renameSection(sectionId: string, name: string): void;
	deleteSection(sectionId: string): void;
	moveSection(sectionId: string, direction: 'up' | 'down'): void;
	moveSlidesToSection(slideIndexes: number[], targetSectionId: string): void;
	toggleSection(sectionId: string): void;
}

export function createSectionActions(
	store: Store<ViewerState>,
	ops: Pick<EditorOps, 'pushHistory' | 'commitChange'>,
): SectionActions {
	const commit = (sections: ViewerState['sections'], slides: ViewerState['slides']): void => {
		ops.pushHistory();
		store.set({ sections, slides });
		ops.commitChange();
	};

	return {
		addSection(name, afterSlideIndex = store.get().currentSlide) {
			const state = store.get();
			const trimmed = name.trim();
			if (!state.editable || !trimmed || !state.slides[afterSlideIndex]) {
				return null;
			}
			const result = addSection(state.sections, state.slides, trimmed, afterSlideIndex);
			const added = result.sections.find(
				(section) => !state.sections.some((current) => current.id === section.id),
			);
			commit(result.sections, result.slides);
			return added?.id ?? null;
		},
		renameSection(sectionId, name) {
			const state = store.get();
			const trimmed = name.trim();
			const section = state.sections.find((candidate) => candidate.id === sectionId);
			if (!state.editable || !section || !trimmed || section.name === trimmed) {
				return;
			}
			const result = renameSection(state.sections, state.slides, sectionId, trimmed);
			commit(result.sections, result.slides);
		},
		deleteSection(sectionId) {
			const state = store.get();
			if (!state.editable || !state.sections.some((section) => section.id === sectionId)) {
				return;
			}
			const result = deleteSection(state.sections, state.slides, sectionId);
			commit(result.sections, result.slides);
		},
		moveSection(sectionId, direction) {
			const state = store.get();
			const next =
				direction === 'up'
					? moveSectionUp(state.sections, sectionId)
					: moveSectionDown(state.sections, sectionId);
			if (!state.editable || next === state.sections) {
				return;
			}
			commit(next, state.slides);
		},
		moveSlidesToSection(slideIndexes, targetSectionId) {
			const state = store.get();
			if (!state.editable || slideIndexes.length === 0) {
				return;
			}
			const result = moveSlidesToSection(
				state.sections,
				state.slides,
				slideIndexes,
				targetSectionId,
			);
			if (result.sections !== state.sections) {
				commit(result.sections, result.slides);
			}
		},
		toggleSection(sectionId) {
			const state = store.get();
			if (!state.sections.some((section) => section.id === sectionId)) {
				return;
			}
			store.set({
				sections: state.sections.map((section) =>
					section.id === sectionId ? { ...section, collapsed: !section.collapsed } : section,
				),
			});
		},
	};
}
