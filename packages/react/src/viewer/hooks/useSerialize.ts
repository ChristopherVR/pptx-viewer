import type {
	PptxSlide,
	PptxHandler,
	PptxHeaderFooter,
	PptxPresentationProperties,
	PptxCoreProperties,
	PptxAppProperties,
	PptxCustomProperty,
	PptxNotesMaster,
	PptxHandoutMaster,
	PptxSection,
} from 'pptx-viewer-core';
import { guidePxToEmu, hasTextProperties } from 'pptx-viewer-core';
/**
 * useSerialize: Builds the `serializeSlides` callback that persists the
 * current slide deck (including header/footer, properties, etc.) via the
 * PptxHandler.
 */
import { useCallback } from 'react';
import type React from 'react';

import { remapTextToSegments } from '../utils/remap-text';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseSerializeInput {
	slides: PptxSlide[];
	activeSlideIndex: number;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	headerFooter: PptxHeaderFooter;
	presentationProperties: PptxPresentationProperties;
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
	sections: PptxSection[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	customProperties: PptxCustomProperty[];
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	handlerRef: React.RefObject<PptxHandler | null>;
	inlineEditingElementIdRef: React.MutableRefObject<string | null>;
	inlineEditingTextRef: React.MutableRefObject<string>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSerialize(input: UseSerializeInput): () => Promise<Uint8Array | null> {
	const {
		slides,
		activeSlideIndex,
		guides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		notesMaster,
		handoutMaster,
		handlerRef,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
	} = input;

	return useCallback(async (): Promise<Uint8Array | null> => {
		const handler = handlerRef.current;
		if (!handler) {
			return null;
		}

		// Apply any in-progress inline text edit at serialize time so that
		// save() captures the live text even when the editor element hasn't
		// been blurred yet (e.g. Ctrl+S while typing inside a text box).
		const pendingEditId = inlineEditingElementIdRef.current;
		const pendingEditText = inlineEditingTextRef.current;

		const slidesWithGuides = slides.map((slide, idx) => {
			// Apply the pending inline edit to the element being edited.
			let processedSlide = slide;
			if (pendingEditId) {
				const updatedElements = slide.elements.map((el) => {
					if (el.id !== pendingEditId || !hasTextProperties(el)) {
						return el;
					}
					return {
						...el,
						text: pendingEditText,
						textSegments: remapTextToSegments(pendingEditText, el.textSegments, el.textStyle),
					};
				});
				if (updatedElements.some((el, i) => el !== slide.elements[i])) {
					processedSlide = { ...slide, elements: updatedElements };
				}
			}

			if (idx !== activeSlideIndex) {
				return processedSlide;
			}
			const pptxGuides = guides.map((g) => ({
				id: g.id,
				orientation: (g.axis === 'h' ? 'horz' : 'vert') as 'horz' | 'vert',
				positionEmu: guidePxToEmu(g.position),
			}));
			return {
				...processedSlide,
				guides: pptxGuides.length > 0 ? pptxGuides : undefined,
			};
		});

		return handler.save(slidesWithGuides, {
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties,
			appProperties,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			notesMaster,
			handoutMaster,
		});
	}, [
		slides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndex,
		handlerRef,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
	]);
}
