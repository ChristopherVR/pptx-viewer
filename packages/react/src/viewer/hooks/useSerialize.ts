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
	PptxSlideMaster,
	PptxSection,
	PptxTagCollection,
} from 'pptx-viewer-core';
import { guidePxToEmu, hasTextProperties } from 'pptx-viewer-core';
import type { DeckSavePurpose, SlideSizeEmu } from 'pptx-viewer-shared';
import {
	embeddedFontSaveOptions,
	resolveSlideSizeSelection,
	saveDeckWithPassword,
} from 'pptx-viewer-shared';
/**
 * useSerialize: Builds the `serializeSlides` callback that persists the
 * current slide deck (including header/footer, properties, etc.) via the
 * PptxHandler.
 */
import { useCallback } from 'react';
import type React from 'react';

import type { CanvasSize } from '../types';
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
	/** The pixel canvas the raw Slide Size W/H inputs edit. */
	canvasSize: CanvasSize;
	/**
	 * The EMU `p:sldSz` the viewer is holding (seeded on load, replaced by a
	 * preset/orientation pick). Passed with `canvasSize` to
	 * `resolveSlideSizeSelection`, which keeps the EMU whenever the two still
	 * agree so a preset survives the save, and takes the pixels when the user
	 * has typed into the raw inputs.
	 */
	slideSizeEmu?: SlideSizeEmu | undefined;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	headerFooter: PptxHeaderFooter;
	presentationProperties: PptxPresentationProperties;
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
	sections: PptxSection[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	customProperties: PptxCustomProperty[];
	tagCollections: PptxTagCollection[];
	/**
	 * The slide masters and their layouts, as View > Slide Master left them.
	 *
	 * Required, not optional: this was the one save option React never passed,
	 * and core rewrites a master or layout part only for the ones the caller
	 * hands back. Every master-view edit therefore showed on screen and was
	 * dropped by the save - a deleted master shape came back on reload, and a
	 * master background reverted to white. The other four bindings pass it.
	 * Core compares each part against the element list parsed at load and
	 * rewrites only what actually changed, so passing the whole array on every
	 * save costs an untouched deck nothing.
	 */
	slideMasters: PptxSlideMaster[];
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	handlerRef: React.RefObject<PptxHandler | null>;
	inlineEditingElementIdRef: React.MutableRefObject<string | null>;
	inlineEditingTextRef: React.MutableRefObject<string>;
	password?: string;
	/**
	 * File > Fonts > "Embed fonts in the file". `false` passes
	 * `embeddedFontList: null`, which strips `p:embeddedFontLst`, the `/font`
	 * relationships and the `.fntdata` parts; `true` (the default) leaves core to
	 * re-embed whatever the deck arrived with. Before this the toggle reached no
	 * save call at all and the saved bytes were identical either way.
	 */
	embedFonts?: boolean;
	/**
	 * Why these bytes are being produced. Defaults to `'user-file'` (Save, Save
	 * As, Export, the imperative `getContent()`), which honours `password`.
	 * `'recovery-snapshot'` is for bytes the viewer reads back itself - the
	 * autosave snapshot and the re-serialise-then-reload cycle - and is always
	 * plaintext, because nothing on the way back in can supply the password.
	 * See `deck-save-encryption` in `pptx-viewer-shared` for the full rationale
	 * and the privacy tradeoff it accepts.
	 */
	purpose?: DeckSavePurpose;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSerialize(input: UseSerializeInput): () => Promise<Uint8Array | null> {
	const {
		slides,
		templateElementsBySlideId,
		activeSlideIndex,
		canvasSize,
		slideSizeEmu,
		guides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		slideMasters,
		notesMaster,
		handoutMaster,
		handlerRef,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
		password,
		embedFonts = true,
		purpose,
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
			// Without this the Slide Size card edited a viewer-only pixel value and
			// the saved `p:sldSz` never moved: passing `slideSize` is the only way a
			// slide-size edit reaches the file.
			slideSize: resolveSlideSizeSelection({ current: slideSizeEmu, canvas: canvasSize }).size,
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties,
			appProperties,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			tags: tagCollections.length > 0 ? tagCollections : undefined,
			slideMasters,
			notesMaster,
			handoutMaster,
			...embeddedFontSaveOptions(embedFonts),
		};

		// One shared decision for all five bindings: a captured password means
		// `saveEncrypted` (OLE2 container), never `save` (plain ZIP) - unless
		// these bytes are a recovery snapshot, which must stay loadable.
		return saveDeckWithPassword(handler, slidesToSave, saveOptions, { password, purpose });
	}, [
		slides,
		templateElementsBySlideId,
		canvasSize,
		slideSizeEmu,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		slideMasters,
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndex,
		handlerRef,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
		password,
		embedFonts,
		purpose,
	]);
}
