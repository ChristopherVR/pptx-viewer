import { createEditorId } from 'pptx-viewer-core';
import type { PptxSlide, PptxTheme } from 'pptx-viewer-core';
import { buildSlideTemplateSlide, templateSchemeFromTheme } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import type { Ref, ShallowRef } from 'vue';

export interface UseSlideTemplateInsertionInput {
	canvasSize: Ref<{ width: number; height: number }>;
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	pushHistory: () => void;
	/** Loaded deck theme; template colours resolve against its colour scheme. */
	theme: ShallowRef<PptxTheme | undefined>;
}

export interface UseSlideTemplateInsertionResult {
	/** Insert the given slide template directly after the active slide. */
	insertSlideFromTemplate: (templateId: SlideTemplateId) => void;
}

/**
 * useSlideTemplateInsertion: Home-tab "Slide Templates" gallery insert path.
 *
 * Builds the complete draft slide via the shared catalogue
 * (`buildSlideTemplateSlide`), themed with the deck's colour scheme, and
 * splices it after the active slide. Mirrors React's
 * `handleInsertSlideFromTemplate` and follows the same history contract as
 * `useElementInsertion.insertSlideFromLayout`: `pushHistory()` BEFORE the
 * mutation, so the insert is undoable through the normal history path.
 */
export function useSlideTemplateInsertion(
	input: UseSlideTemplateInsertionInput,
): UseSlideTemplateInsertionResult {
	const { canvasSize, slides, activeSlideIndex, pushHistory, theme } = input;

	function insertSlideFromTemplate(templateId: SlideTemplateId): void {
		const insertAt = Math.max(0, Math.min(activeSlideIndex.value + 1, slides.value.length));
		pushHistory();
		const draft = buildSlideTemplateSlide(
			templateId,
			createEditorId('slide'),
			slides.value.length + 1,
			{
				slideWidth: canvasSize.value.width,
				slideHeight: canvasSize.value.height,
				scheme: templateSchemeFromTheme(theme.value?.colorScheme),
			},
		);
		const next = slides.value.slice();
		next.splice(insertAt, 0, draft);
		slides.value = next;
		activeSlideIndex.value = insertAt;
	}

	return { insertSlideFromTemplate };
}
