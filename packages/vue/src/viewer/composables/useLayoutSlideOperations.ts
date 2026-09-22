import { createEditorId } from 'pptx-viewer-core';
import type { PptxHandler, PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
import type { Ref, ShallowRef } from 'vue';

import type { TemplateElementMap } from './template-editing';

interface Input {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	handler: ShallowRef<PptxHandler | null>;
	pushHistory: () => void;
	templateElementsBySlideId?: Ref<TemplateElementMap>;
}

export function useLayoutSlideOperations(input: Input) {
	const { slides, activeSlideIndex, handler, pushHistory, templateElementsBySlideId } = input;

	async function loadLayoutPreviews(): Promise<PptxLayoutPreview[]> {
		return handler.value ? handler.value.getLayoutPreviews() : [];
	}

	async function applyLayoutToActiveSlide(layoutPath: string): Promise<void> {
		const h = handler.value;
		const index = activeSlideIndex.value;
		const target = slides.value[index];
		if (!h || !target) {
			return;
		}
		const updated = await h.applyLayoutToSlide(index, layoutPath, slides.value).catch(() => null);
		if (!updated || slides.value[index]?.id !== target.id) {
			return;
		}
		const elements = templateElementsBySlideId
			? await h.getTemplateElementsForSlide(updated.id).catch(() => [])
			: undefined;
		if (slides.value[index]?.id !== target.id) {
			return;
		}
		pushHistory();
		const next = slides.value.slice();
		next[index] = updated;
		slides.value = next;
		if (templateElementsBySlideId) {
			templateElementsBySlideId.value = {
				...templateElementsBySlideId.value,
				[updated.id]: elements ?? [],
			};
		}
	}

	async function insertSlideFromLayout(layoutPath: string, layoutName?: string): Promise<void> {
		const insertAt = activeSlideIndex.value + 1;
		pushHistory();
		const draft = {
			id: createEditorId('slide'),
			rId: '',
			slideNumber: slides.value.length + 1,
			elements: [],
			layoutPath,
			...(layoutName ? { layoutName } : {}),
		} as unknown as PptxSlide;
		const next = slides.value.slice();
		next.splice(insertAt, 0, draft);
		slides.value = next;
		activeSlideIndex.value = insertAt;
		const h = handler.value;
		if (!h) {
			return;
		}
		const updated = await h
			.applyLayoutToSlide(insertAt, layoutPath, slides.value)
			.catch(() => null);
		if (!updated || updated.id !== draft.id || slides.value[insertAt]?.id !== draft.id) {
			return;
		}
		const elements = templateElementsBySlideId
			? await h.getTemplateElementsForSlide(updated.id).catch(() => [])
			: undefined;
		if (slides.value[insertAt]?.id !== draft.id) {
			return;
		}
		const merged = slides.value.slice();
		merged[insertAt] = updated;
		slides.value = merged;
		if (templateElementsBySlideId) {
			templateElementsBySlideId.value = {
				...templateElementsBySlideId.value,
				[updated.id]: elements ?? [],
			};
		}
	}

	return { loadLayoutPreviews, applyLayoutToActiveSlide, insertSlideFromLayout };
}
