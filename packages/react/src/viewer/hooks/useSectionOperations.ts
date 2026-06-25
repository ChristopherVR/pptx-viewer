import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import {
	addSection as addSectionTransform,
	deleteSection as deleteSectionTransform,
	moveSectionDown as moveSectionDownTransform,
	moveSectionUp as moveSectionUpTransform,
	moveSlidesToSection as moveSlidesToSectionTransform,
	renameSection as renameSectionTransform,
} from 'pptx-viewer-shared';
/**
 * useSectionOperations: CRUD operations for slide sections.
 */
import { useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

export interface UseSectionOperationsInput {
	sections: PptxSection[];
	setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
	slides: PptxSlide[];
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	markDirty: () => void;
}

export interface SectionOperations {
	addSection: (name: string, afterSlideIndex: number) => void;
	renameSection: (sectionId: string, newName: string) => void;
	deleteSection: (sectionId: string) => void;
	moveSectionUp: (sectionId: string) => void;
	moveSectionDown: (sectionId: string) => void;
	moveSlidesToSection: (slideIndexes: number[], targetSectionId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useSectionOperations(input: UseSectionOperationsInput): SectionOperations {
	const { sections, setSections, slides, setSlides, markDirty } = input;

	const addSection = useCallback(
		(name: string, afterSlideIndex: number) => {
			const result = addSectionTransform(sections, slides, name, afterSlideIndex);
			setSlides(result.slides);
			setSections(result.sections);
			markDirty();
		},
		[sections, slides, setSlides, setSections, markDirty],
	);

	const renameSection = useCallback(
		(sectionId: string, newName: string) => {
			const result = renameSectionTransform(sections, slides, sectionId, newName);
			setSections(result.sections);
			setSlides(result.slides);
			markDirty();
		},
		[sections, slides, setSections, setSlides, markDirty],
	);

	const deleteSection = useCallback(
		(sectionId: string) => {
			const result = deleteSectionTransform(sections, slides, sectionId);
			setSections(result.sections);
			setSlides(result.slides);
			markDirty();
		},
		[sections, slides, setSections, setSlides, markDirty],
	);

	const moveSectionUp = useCallback(
		(sectionId: string) => {
			setSections(moveSectionUpTransform(sections, sectionId));
			markDirty();
		},
		[sections, setSections, markDirty],
	);

	const moveSectionDown = useCallback(
		(sectionId: string) => {
			setSections(moveSectionDownTransform(sections, sectionId));
			markDirty();
		},
		[sections, setSections, markDirty],
	);

	const moveSlidesToSection = useCallback(
		(slideIndexes: number[], targetSectionId: string) => {
			const result = moveSlidesToSectionTransform(sections, slides, slideIndexes, targetSectionId);
			setSlides(result.slides);
			setSections(result.sections);
			markDirty();
		},
		[sections, slides, setSlides, setSections, markDirty],
	);

	return {
		addSection,
		renameSection,
		deleteSection,
		moveSectionUp,
		moveSectionDown,
		moveSlidesToSection,
	};
}
