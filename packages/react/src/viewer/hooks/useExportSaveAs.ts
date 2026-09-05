import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxData,
	PptxElement,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxTagCollection,
	PptxTheme,
} from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
import {
	downloadBlob,
	exportDeckJson,
	resolveSlideSizeSelection,
	savedPresentationFileName,
} from 'pptx-viewer-shared';

import type { CanvasSize } from '../types';
import { buildSaveSlides } from '../utils/template-editing';
import type { SerializeSlides } from './useSerialize';

/**
 * useExportSaveAs: Save-As format handlers and the deck-JSON export.
 *
 * Save As is `useSerialize` with an output format. It used to assemble a
 * SECOND save-options object of its own, and every option added to
 * `useSerialize` afterwards (`viewProperties`, the table-style map and its
 * default id / deletions, `embedFonts`) was missing from it: a table style
 * edited in the inspector reached `getContent()` and autosave, but the file
 * the backstage Save button downloaded came back with `ppt/tableStyles.xml`
 * byte-identical to the original. The other four bindings route the format
 * through their main builder; React now does too.
 */
export interface UseExportSaveAsInput {
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back at save time. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	filePath: string | undefined;
	/** `useSerialize`'s callback: the one place save options are assembled. */
	serializeSlides: SerializeSlides;
	/** Presentation-level state, carried into the deck-JSON export document. */
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
	/** Live theme, carried into the deck-JSON export document. */
	theme: PptxTheme | undefined;
	/** Slide canvas size in CSS pixels, carried into the deck-JSON export. */
	canvasSize: CanvasSize;
	/** The EMU `p:sldSz` the viewer holds; see `UseExportHandlersInput`. */
	slideSizeEmu?: SlideSizeEmu | undefined;
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
		serializeSlides,
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
		theme,
		canvasSize,
		slideSizeEmu,
	} = input;

	const handleSaveAsFormat = async (format: PptxSaveFormat): Promise<void> => {
		// One shared decision for "what should the saved copy be called": the
		// source stem plus the extension of the format actually being written.
		// A `.ppt` source therefore saves as `.pptx`, as it does in PowerPoint.
		const downloadName = savedPresentationFileName(filePath, format);
		try {
			const data = await serializeSlides(format);
			if (!data) {
				// No handler loaded yet: nothing to write.
				return;
			}
			const blob = new Blob([data as BlobPart], {
				type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			});
			downloadBlob(blob, downloadName);
		} catch (err) {
			console.error(`[PowerPointViewer] Save as .${format} failed:`, err);
		}
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
		const data: PptxData = {
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
			coreProperties,
			appProperties,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			tags: tagCollections.length > 0 ? tagCollections : undefined,
			notesMaster,
			handoutMaster,
		};
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
