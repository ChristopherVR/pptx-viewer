import type { PptxSection } from 'pptx-viewer-core';
import {
	addSection,
	deleteSection,
	groupSlidesBySection,
	moveSectionDown,
	moveSectionUp,
	moveSlidesToSection,
	renameSection,
} from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/** History-aware section CRUD and grouping for the Svelte editor. */
export class EditorSectionController {
	constructor(private readonly editor: EditorState) {}

	get groups() {
		return groupSlidesBySection(this.editor.sections, this.editor.slides);
	}

	add(name: string, afterSlideIndex = this.editor.currentSlideIndex): string | null {
		if (!this.editor.editable || this.editor.slides.length === 0) {
			return null;
		}
		const result = addSection(this.editor.sections, this.editor.slides, name, afterSlideIndex);
		const added = result.sections.find(
			(section) => !this.editor.sections.some((s) => s.id === section.id),
		);
		this.commit(result.sections, result.slides);
		return added?.id ?? null;
	}

	rename(sectionId: string, name: string): void {
		const trimmed = name.trim();
		const current = this.editor.sections.find((section) => section.id === sectionId);
		if (!this.editor.editable || !trimmed || !current || current.name === trimmed) {
			return;
		}
		const result = renameSection(this.editor.sections, this.editor.slides, sectionId, trimmed);
		this.commit(result.sections, result.slides);
	}

	delete(sectionId: string): void {
		if (
			!this.editor.editable ||
			!this.editor.sections.some((section) => section.id === sectionId)
		) {
			return;
		}
		const result = deleteSection(this.editor.sections, this.editor.slides, sectionId);
		this.commit(result.sections, result.slides);
	}

	moveUp(sectionId: string): void {
		const next = moveSectionUp(this.editor.sections, sectionId);
		if (!this.editor.editable || next === this.editor.sections) {
			return;
		}
		this.commit(next, this.editor.slides);
	}

	moveDown(sectionId: string): void {
		const next = moveSectionDown(this.editor.sections, sectionId);
		if (!this.editor.editable || next === this.editor.sections) {
			return;
		}
		this.commit(next, this.editor.slides);
	}

	moveSlides(slideIndexes: number[], targetSectionId: string): void {
		if (!this.editor.editable || slideIndexes.length === 0) {
			return;
		}
		const result = moveSlidesToSection(
			this.editor.sections,
			this.editor.slides,
			slideIndexes,
			targetSectionId,
		);
		if (result.sections !== this.editor.sections) {
			this.commit(result.sections, result.slides);
		}
	}

	toggle(sectionId: string): void {
		this.editor.sections = this.editor.sections.map((section) =>
			section.id === sectionId ? { ...section, collapsed: !section.collapsed } : section,
		);
	}

	private commit(sections: PptxSection[], slides: typeof this.editor.slides): void {
		this.editor.pushHistory();
		this.editor.sections = sections;
		this.editor.slides = slides;
		this.editor.commitChange();
	}
}
