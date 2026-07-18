import type {
	PptxElement,
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
	PptxTagCollection,
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
import { buildSaveSlides } from '../utils/template-editing';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseSerializeInput {
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back at save time. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	activeSlideIndex: number;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	headerFooter: PptxHeaderFooter;
	presentationProperties: PptxPresentationProperties;
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
	sections: PptxSection[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	customProperties: PptxCustomProperty[];
	tagCollections: PptxTagCollection[];
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	handlerRef: React.RefObject<PptxHandler | null>;
	inlineEditingElementIdRef: React.MutableRefObject<string | null>;
	inlineEditingTextRef: React.MutableRefObject<string>;
	password?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSerialize(input: UseSerializeInput): () => Promise<Uint8Array | null> {
	const {
		slides,
		templateElementsBySlideId,
		activeSlideIndex,
		guides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		notesMaster,
		handoutMaster,
		handlerRef,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
		password,
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

		// Merge the separated template (master/layout) elements back into each
		// slide so edits made in edit-template mode persist to the shared part.
		const slidesToSave = buildSaveSlides(slidesWithGuides, templateElementsBySlideId);

		const saveOptions = {
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties,
			appProperties,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			tags: tagCollections.length > 0 ? tagCollections : undefined,
			notesMaster,
			handoutMaster,
		};

		if (password) {
			return handler.saveEncrypted(slidesToSave, password, saveOptions);
		}
		return handler.save(slidesToSave, saveOptions);
	}, [
		slides,
		templateElementsBySlideId,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndex,
		handlerRef,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
		password,
	]);
}
