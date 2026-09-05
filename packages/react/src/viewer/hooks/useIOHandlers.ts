import type { PptxSlide, PptxHandler } from 'pptx-viewer-core';
/**
 * useIOHandlers: Composes export, print, theme, and property-handler hooks
 * into a single grouped return value for the orchestrator component.
 */
import type React from 'react';

import type { CanvasSize } from '../types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import { useExportHandlers } from './useExportHandlers';
import type { ExportHandlersResult } from './useExportHandlers';
import { usePrintHandlers } from './usePrintHandlers';
import type { PrintHandlersResult } from './usePrintHandlers';
import { usePropertyHandlers } from './usePropertyHandlers';
import type { PropertyHandlersResult } from './usePropertyHandlers';
import type { SerializeSlides } from './useSerialize';
import { useThemeHandlers } from './useThemeHandlers';
import type { ThemeHandlersResult } from './useThemeHandlers';
import type { ViewerState } from './useViewerState';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseIOHandlersInput {
	state: ViewerState;
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	filePath: string | undefined;
	history: EditorHistoryResult;
	ops: ElementOperations;
	zoom: {
		canvasStageRef: React.RefObject<HTMLDivElement | null>;
	};
	handlerRef: React.RefObject<PptxHandler | null>;
	/**
	 * The one user-facing serialiser (`useSerialize`). Save As passes it the
	 * output format, so the downloaded file carries every save option Save does.
	 */
	serializeSlides: SerializeSlides;
	/**
	 * Plaintext serialisation for bytes the viewer feeds straight back into its
	 * own loader. "Apply theme" does exactly that, and the loader has no password
	 * to offer, so it must never receive an encrypted package.
	 */
	serializeForRecovery: () => Promise<Uint8Array | null>;
	setContent: React.Dispatch<React.SetStateAction<ArrayBuffer | Uint8Array | null>>;
	onContentChange: ((content: Uint8Array) => void) | undefined;
	/** File > Options > Advanced > "Image Size and Quality" raster-scale multiplier. */
	imageExportScale?: number;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface IOHandlersResult {
	exportHandlers: ExportHandlersResult;
	printHandlers: PrintHandlersResult;
	themeHandlers: ThemeHandlersResult;
	propertyHandlers: PropertyHandlersResult;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIOHandlers(input: UseIOHandlersInput): IOHandlersResult {
	const {
		state,
		slides,
		activeSlideIndex,
		canvasSize,
		filePath,
		history,
		ops,
		zoom,
		handlerRef,
		serializeSlides,
		serializeForRecovery,
		setContent,
		onContentChange,
		imageExportScale,
	} = input;

	const exportHandlers = useExportHandlers({
		slides,
		templateElementsBySlideId: state.templateElementsBySlideId,
		activeSlide: slides[activeSlideIndex],
		activeSlideIndex,
		filePath,
		canvasStageRef: zoom.canvasStageRef,
		setActiveSlideIndex: state.setActiveSlideIndex,
		serializeSlides,
		headerFooter: state.headerFooter,
		presentationProperties: state.presentationProperties,
		customShows: state.customShows,
		sections: state.sections,
		coreProperties: state.coreProperties,
		appProperties: state.appProperties,
		customProperties: state.customProperties,
		tagCollections: state.tagCollections,
		notesMaster: state.notesMaster,
		handoutMaster: state.handoutMaster,
		theme: state.theme,
		canvasSize,
		slideSizeEmu: state.slideSizeEmu,
		imageExportScale,
	});

	const printHandlers = usePrintHandlers({
		slides,
		activeSlideIndex,
		canvasStageRef: zoom.canvasStageRef,
		setActiveSlideIndex: state.setActiveSlideIndex,
	});

	const themeHandlers = useThemeHandlers({
		handlerRef,
		// Theme apply re-serialises and re-parses through `setContent`, so these
		// bytes go back into our own loader: plaintext, never the protected save.
		serializeSlides: serializeForRecovery,
		setContent,
		onContentChange,
		setTheme: state.setTheme as unknown as React.Dispatch<
			React.SetStateAction<Record<string, unknown> | null>
		>,
		setSlideMasters: state.setSlideMasters as unknown as React.Dispatch<
			React.SetStateAction<Array<Record<string, unknown>>>
		>,
		slideMasters: state.slideMasters as unknown as Array<Record<string, unknown>>,
		history,
		setSlides: state.setSlides,
		templateElementsBySlideId: state.templateElementsBySlideId,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		theme: state.theme,
		bumpHistory: () => state.setPointerCommitNonce((n) => n + 1),
	});

	const propertyHandlers = usePropertyHandlers({
		slides,
		activeSlideIndex,
		canvasSize,
		setContent,
		setPresentationProperties: state.setPresentationProperties,
		setCoreProperties: state.setCoreProperties as unknown as React.Dispatch<
			React.SetStateAction<import('pptx-viewer-core').PptxCoreProperties | null>
		>,
		setAppProperties: state.setAppProperties as unknown as React.Dispatch<
			React.SetStateAction<import('pptx-viewer-core').PptxAppProperties | null>
		>,
		setCustomProperties: state.setCustomProperties,
		setSlides: state.setSlides,
		setIsDirty: state.setIsDirty,
		ops,
		history,
	});

	return { exportHandlers, printHandlers, themeHandlers, propertyHandlers };
}
