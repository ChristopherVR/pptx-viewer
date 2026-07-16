import type { PptxSection, PptxSlide } from 'pptx-viewer-core';

import {
	addSection,
	deleteSection,
	moveSectionDown,
	moveSectionUp,
	renameSection,
} from '../internal/shared';

export interface EditorSectionOperations {
	add(afterSlideIndex: number, name: string): void;
	rename(sectionId: string, name: string): void;
	delete(sectionId: string): void;
	move(sectionId: string, direction: 'up' | 'down'): void;
	toggle(sectionId: string): void;
}

interface SectionOperationsHost {
	sections(): readonly PptxSection[];
	slides(): readonly PptxSlide[];
	commit(sections: readonly PptxSection[], slides: readonly PptxSlide[]): void;
}

/** Bind shared immutable section transforms to Angular editor state. */
export function createEditorSectionOperations(
	host: SectionOperationsHost,
): EditorSectionOperations {
	return {
		add(afterSlideIndex, name) {
			if (!host.slides()[afterSlideIndex]) {
				return;
			}
			const result = addSection(host.sections(), host.slides(), name, afterSlideIndex);
			host.commit(result.sections, result.slides);
		},
		rename(sectionId, name) {
			const trimmed = name.trim();
			const section = host.sections().find((candidate) => candidate.id === sectionId);
			if (!section || !trimmed || trimmed === section.name) {
				return;
			}
			const result = renameSection(host.sections(), host.slides(), sectionId, trimmed);
			host.commit(result.sections, result.slides);
		},
		delete(sectionId) {
			if (!host.sections().some((section) => section.id === sectionId)) {
				return;
			}
			const result = deleteSection(host.sections(), host.slides(), sectionId);
			host.commit(result.sections, result.slides);
		},
		move(sectionId, direction) {
			const next =
				direction === 'up'
					? moveSectionUp(host.sections(), sectionId)
					: moveSectionDown(host.sections(), sectionId);
			if (next !== host.sections()) {
				host.commit(next, host.slides());
			}
		},
		toggle(sectionId) {
			if (!host.sections().some((section) => section.id === sectionId)) {
				return;
			}
			host.commit(
				host
					.sections()
					.map((section) =>
						section.id === sectionId ? { ...section, collapsed: !section.collapsed } : section,
					),
				host.slides(),
			);
		},
	};
}
