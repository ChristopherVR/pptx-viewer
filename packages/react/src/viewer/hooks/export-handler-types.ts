import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxElement,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxSaveFormat,
	PptxTagCollection,
	PptxTheme,
} from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
/**
 * Types and utility helpers for export handlers.
 */
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';

import type { CanvasSize } from '../types';
import type { SerializeSlides } from './useSerialize';

export interface UseExportHandlersInput {
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back at save time. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	filePath: string | undefined;
	canvasStageRef: RefObject<HTMLDivElement | null>;
	setActiveSlideIndex: Dispatch<SetStateAction<number>>;
	/**
	 * The binding's one user-facing serialiser (`useSerialize`), which Save As
	 * calls with the chosen output format. Save As no longer assembles its own
	 * save options, so it cannot drift from Save again.
	 */
	serializeSlides: SerializeSlides;
	/** Presentation-level state carried into the deck-JSON export document. */
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
	/** The EMU `p:sldSz` the viewer holds, for the deck-JSON export's slide size. */
	slideSizeEmu?: SlideSizeEmu | undefined;
	/**
	 * File > Options > Advanced > "Image Size and Quality"
	 * (`resolveImageResolutionScale`), the raster-scale multiplier for PNG/PDF
	 * export and copy-slide-as-image. Defaults to 2 (the pre-existing hardcoded
	 * behavior) when omitted.
	 */
	imageExportScale?: number;
	/**
	 * The raw `resolveImageResolutionScale(viewerOptions)` multiplier (1 at the
	 * default "High fidelity" preset), fed into the shared
	 * `resolveExportCaptureDecision` for GIF/video capture scale. Distinct from
	 * `imageExportScale` (which already has the PNG/PDF 2x baseline folded in):
	 * GIF/video derive their own baseline from this via the shared decision
	 * function instead of reusing `imageExportScale` outright, so a future
	 * GIF/video-specific baseline change only touches that one function.
	 * Defaults to 1 when omitted.
	 */
	imageResolutionScale?: number;
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
	handleSaveAsPpt: () => void;
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
