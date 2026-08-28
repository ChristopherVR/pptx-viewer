import type {
	PptxElement,
	PptxSlide,
	PptxSaveFormat,
	PptxHandler,
	PptxSlideMaster,
	PptxTheme,
} from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
/**
 * Types and utility helpers for export handlers.
 */
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';

import type { CanvasSize } from '../types';

export interface UseExportHandlersInput {
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back at save time. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	filePath: string | undefined;
	canvasStageRef: RefObject<HTMLDivElement | null>;
	setActiveSlideIndex: Dispatch<SetStateAction<number>>;
	handlerRef: RefObject<PptxHandler | null>;
	/** State from the viewer needed for save-as */
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
	/** The slide masters and their layouts; see `UseExportSaveAsInput`. */
	slideMasters: PptxSlideMaster[];
	notesMaster: Record<string, unknown> | undefined;
	handoutMaster: Record<string, unknown> | undefined;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	activeSlideIndexForGuides: number;
	/** Live theme, carried into the deck-JSON export document. */
	theme: PptxTheme | undefined;
	/** Slide canvas size in CSS pixels, carried into the deck-JSON export. */
	canvasSize: CanvasSize;
	/**
	 * The EMU `p:sldSz` the viewer holds. Save-As builds its own save options
	 * rather than reusing `useSerialize`, so without this a Slide Size edit
	 * reached Save and not Save As (or the backstage Save, which routes here).
	 */
	slideSizeEmu?: SlideSizeEmu | undefined;
	password?: string;
	/**
	 * File > Options > Advanced > "Image Size and Quality"
	 * (`resolveImageResolutionScale`), the raster-scale multiplier for PNG/PDF
	 * export and copy-slide-as-image. Defaults to 2 (the pre-existing hardcoded
	 * behavior) when omitted.
	 */
	imageExportScale?: number;
}

export interface ExportHandlersResult {
	handleExportPng: () => Promise<void>;
	handleExportPdf: () => Promise<void>;
	handleExportNotesPdf: () => Promise<void>;
	handleCopySlideAsImage: () => Promise<void>;
	handleExportVideo: () => Promise<void>;
	handleExportGif: () => Promise<void>;
	handleExportJson: () => void;
	handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>;
	handleSaveAsPptx: () => void;
	handleSaveAsPpsx: () => void;
	handleSaveAsPptm: () => void;
	handleCancelExport: () => void;
	exportModalOpen: boolean;
	exportModalTitle: string;
	exportProgress: number;
	exportStatusMessage: string;
}

/** Controls for the shared export-progress modal, passed to sub-hooks. */
export interface ExportModalControls {
	setExportModalOpen: (open: boolean) => void;
	setExportModalTitle: (title: string) => void;
	setExportProgress: (progress: number) => void;
	setExportStatusMessage: (message: string) => void;
	exportAbortRef: MutableRefObject<AbortController | null>;
}
