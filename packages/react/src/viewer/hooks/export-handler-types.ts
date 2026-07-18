import type { PptxElement, PptxSlide, PptxSaveFormat, PptxHandler } from 'pptx-viewer-core';
/**
 * Types and utility helpers for export handlers.
 */
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';

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
	serializeSlides: () => Promise<Uint8Array | null>;
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
	notesMaster: Record<string, unknown> | undefined;
	handoutMaster: Record<string, unknown> | undefined;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	activeSlideIndexForGuides: number;
	password?: string;
}

export interface ExportHandlersResult {
	handleExportPng: () => Promise<void>;
	handleExportPdf: () => Promise<void>;
	handleExportNotesPdf: () => Promise<void>;
	handleCopySlideAsImage: () => Promise<void>;
	handleExportVideo: () => Promise<void>;
	handleExportGif: () => Promise<void>;
	handlePackageForSharing: () => Promise<void>;
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
