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
	serializeSlides: () => Promise<Uint8Array | null>;
	setContent: React.Dispatch<React.SetStateAction<ArrayBuffer | Uint8Array | null>>;
	onContentChange: ((content: Uint8Array) => void) | undefined;
	password?: string;
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
		setContent,
		onContentChange,
		password,
	} = input;

	const exportHandlers = useExportHandlers({
		slides,
		templateElementsBySlideId: state.templateElementsBySlideId,
		activeSlide: slides[activeSlideIndex],
		activeSlideIndex,
		filePath,
		canvasStageRef: zoom.canvasStageRef,
		setActiveSlideIndex: state.setActiveSlideIndex,
		handlerRef,
		serializeSlides,
		headerFooter: state.headerFooter as unknown as Record<string, unknown>,
		presentationProperties: state.presentationProperties as unknown as Record<string, unknown>,
		customShows: state.customShows,
		sections: state.sections,
		coreProperties: (state.coreProperties ?? null) as Record<string, unknown> | null,
		appProperties: (state.appProperties ?? null) as Record<string, unknown> | null,
		customProperties: state.customProperties as unknown as Array<Record<string, unknown>>,
		tagCollections: state.tagCollections as unknown as Array<Record<string, unknown>>,
		notesMaster: state.notesMaster as unknown as Record<string, unknown> | undefined,
		handoutMaster: state.handoutMaster as unknown as Record<string, unknown> | undefined,
		guides: state.guides,
		activeSlideIndexForGuides: state.activeSlideIndex,
		password,
	});

	const printHandlers = usePrintHandlers({
		slides,
		activeSlideIndex,
		canvasStageRef: zoom.canvasStageRef,
		setActiveSlideIndex: state.setActiveSlideIndex,
	});

	const themeHandlers = useThemeHandlers({
		handlerRef,
		serializeSlides,
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
