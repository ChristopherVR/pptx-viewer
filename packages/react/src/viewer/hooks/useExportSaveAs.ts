import type {
	PptxData,
	PptxElement,
	PptxSlide,
	PptxSaveFormat,
	PptxHandler,
	PptxSlideMaster,
	PptxTheme,
} from 'pptx-viewer-core';
import { guidePxToEmu } from 'pptx-viewer-core';
import type { DeckSaveOptions, SlideSizeEmu } from 'pptx-viewer-shared';
import {
	downloadBlob,
	exportDeckJson,
	resolveSlideSizeSelection,
	savedPresentationFileName,
	saveDeckWithPassword,
} from 'pptx-viewer-shared';
/**
 * useExportSaveAs: Save-As format handlers.
 */
import type { RefObject } from 'react';

import type { CanvasSize } from '../types';
import { buildSaveSlides } from '../utils/template-editing';

export interface UseExportSaveAsInput {
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back at save time. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	filePath: string | undefined;
	handlerRef: RefObject<PptxHandler | null>;
	headerFooter: Record<string, unknown>;
	presentationProperties: Record<string, unknown>;
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
	sections: Array<{
		id: string;
		name: string;
		color?: string;
		collapsed?: boolean;
	}>;
	coreProperties: Record<string, unknown> | null;
	appProperties: Record<string, unknown> | null;
	customProperties: Array<Record<string, unknown>>;
	tagCollections: Array<Record<string, unknown>>;
	/**
	 * The slide masters and their layouts, as View > Slide Master left them.
	 * Save As builds its own options rather than reusing `useSerialize`, so it
	 * needs the same array: without it a master-view edit reached Save and not
	 * Save As. (For a long while it reached neither.)
	 */
	slideMasters: PptxSlideMaster[];
	notesMaster: Record<string, unknown> | undefined;
	handoutMaster: Record<string, unknown> | undefined;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	activeSlideIndexForGuides: number;
	/** Live theme, carried into the deck-JSON export document. */
	theme: PptxTheme | undefined;
	/** Slide canvas size in CSS pixels, carried into the deck-JSON export. */
	canvasSize: CanvasSize;
	/** The EMU `p:sldSz` the viewer holds; see `UseExportHandlersInput`. */
	slideSizeEmu?: SlideSizeEmu | undefined;
	password?: string;
}

export interface ExportSaveAsResult {
	handleExportJson: () => void;
	handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>;
	handleSaveAsPptx: () => void;
	handleSaveAsPpsx: () => void;
	handleSaveAsPptm: () => void;
}

export function useExportSaveAs(input: UseExportSaveAsInput): ExportSaveAsResult {
	const {
		slides,
		templateElementsBySlideId,
		filePath,
		handlerRef,
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
		activeSlideIndexForGuides,
		theme,
		canvasSize,
		slideSizeEmu,
		password,
	} = input;

	const handleSaveAsFormat = async (format: PptxSaveFormat): Promise<void> => {
		const handler = handlerRef.current;
		if (!handler) {
			return;
		}
		// One shared decision for "what should the saved copy be called": the
		// source stem plus the extension of the format actually being written.
		// A `.ppt` source therefore saves as `.pptx`, as it does in PowerPoint.
		const downloadName = savedPresentationFileName(filePath, format);
		try {
			const data = await buildSaveAsData(handler, format);
			const blob = new Blob([data as BlobPart], {
				type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			});
			downloadBlob(blob, downloadName);
		} catch (err) {
			console.error(`[PowerPointViewer] Save as .${format} failed:`, err);
		}
	};

	const buildSaveAsData = async (
		handler: PptxHandler,
		format: PptxSaveFormat,
	): Promise<Uint8Array> => {
		const slidesWithGuides = slides.map((slide, idx) => {
			if (idx !== activeSlideIndexForGuides) {
				return slide;
			}
			const pptxGuides = guides.map((g) => ({
				id: g.id,
				orientation: (g.axis === 'h' ? 'horz' : 'vert') as 'horz' | 'vert',
				positionEmu: guidePxToEmu(g.position),
			}));
			return {
				...slide,
				guides: pptxGuides.length > 0 ? pptxGuides : undefined,
			};
		});
		// Merge the separated template (master/layout) elements back so edits made
		// in edit-template mode persist into the saved package.
		const slidesToSave = buildSaveSlides(slidesWithGuides, templateElementsBySlideId);
		const saveOptions = {
			// Save As shares Save's slide-size decision; leaving it out here is how
			// a preset picked in the inspector reached one save path and not the other.
			slideSize: resolveSlideSizeSelection({ current: slideSizeEmu, canvas: canvasSize }).size,
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties: coreProperties ?? undefined,
			appProperties: appProperties ?? undefined,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			tags: tagCollections.length > 0 ? tagCollections : undefined,
			slideMasters,
			notesMaster,
			handoutMaster,
			outputFormat: format,
		};
		// Same shared decision as `useSerialize`, so Save-As cannot drift from Save.
		return saveDeckWithPassword(handler, slidesToSave, saveOptions as DeckSaveOptions, password);
	};

	/**
	 * "Export as JSON" backstage card: serialize the live deck to a portable
	 * `pptx-viewer-json` document and download it immediately (no sub-dialog).
	 * Mirrors the Save-As path: template (master/layout) elements are folded
	 * back into the slides and the presentation-level state travels along, so
	 * the JSON document reloads with the same fidelity as a saved .pptx.
	 */
	const handleExportJson = () => {
		const sourceName = filePath ? filePath.replace(/\\/gu, '/').split('/').pop() : undefined;
		// Same slide-size decision as the .pptx paths, so the JSON document does
		// not quietly round a preset away through its pixel canvas.
		const slideSize = resolveSlideSizeSelection({ current: slideSizeEmu, canvas: canvasSize }).size;
		const data = {
			slides: buildSaveSlides(slides, templateElementsBySlideId),
			width: canvasSize.width,
			height: canvasSize.height,
			widthEmu: slideSize.widthEmu,
			heightEmu: slideSize.heightEmu,
			slideSizeType: slideSize.type === '' ? undefined : slideSize.type,
			theme,
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties: coreProperties ?? undefined,
			appProperties: appProperties ?? undefined,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			tags: tagCollections.length > 0 ? tagCollections : undefined,
			notesMaster,
			handoutMaster,
		} as unknown as PptxData;
		try {
			exportDeckJson(data, sourceName);
		} catch (err) {
			console.error('[PowerPointViewer] JSON export failed:', err);
		}
	};

	const handleSaveAsPptx = () => {
		void handleSaveAsFormat('pptx');
	};
	const handleSaveAsPpsx = () => {
		void handleSaveAsFormat('ppsx');
	};
	const handleSaveAsPptm = () => {
		void handleSaveAsFormat('pptm');
	};

	return {
		handleExportJson,
		handleSaveAsFormat,
		handleSaveAsPptx,
		handleSaveAsPpsx,
		handleSaveAsPptm,
	};
}
