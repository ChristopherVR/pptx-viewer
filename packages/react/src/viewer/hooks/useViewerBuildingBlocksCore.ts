import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import type { ViewerOptions } from 'pptx-viewer-shared';
/**
 * useViewerBuildingBlocksCore: The "core state" third of
 * `useViewerBuildingBlocks`'s hook wiring (state, zoom, history, derived
 * slide state, presentation setup), split out to keep every file under the
 * project's per-file line limit. See `useViewerBuildingBlocksState.ts` for
 * the dialogs / editor-operations / integration half that consumes this.
 *
 * Calls the exact same hooks, in the exact same order/wiring, as the
 * corresponding section of `PowerPointViewer.tsx`.
 */
import { resolveHistoryDepth, resolveImageResolutionScale } from 'pptx-viewer-shared';
import { useCallback } from 'react';

import type { ViewerMode } from '../types-core';
import { useDerivedSlideState } from './useDerivedSlideState';
import type { EditorHistoryResult } from './useEditorHistory';
import { useEditorHistory } from './useEditorHistory';
import type { UsePresentationAnnotationsResult } from './usePresentationAnnotations';
import type { UsePresentationModeResult } from './usePresentationMode';
import { usePresentationSetup } from './usePresentationSetup';
import { useViewerOptions } from './useViewerOptions';
import type { ViewerState } from './useViewerState';
import { useViewerState } from './useViewerState';
import type { UseZoomViewportResult } from './useZoomViewport';
import { useZoomViewport } from './useZoomViewport';

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface UseViewerBuildingBlocksCoreInput {
	content: ArrayBuffer | Uint8Array | null;
	canEdit: boolean;
}

export interface ViewerBuildingBlocksCore {
	state: ViewerState;
	mode: ViewerMode;
	slides: PptxSlide[];
	loading: boolean;
	error: string | null;
	activeSlideIndex: number;
	activeSlide: PptxSlide | undefined;
	selectedElement: ViewerState['selectedElement'];
	zoom: UseZoomViewportResult;
	history: EditorHistoryResult;
	presentation: UsePresentationModeResult;
	annotations: UsePresentationAnnotationsResult;
	actionSoundHandlerRef: React.MutableRefObject<PptxHandler | null>;
	/** See `usePresentationSetup`'s `setExitModeHandler`. */
	setExitModeHandler: (handler: ((nextMode: ViewerMode) => void) | null) => void;
	masterPseudoSlide: PptxSlide | undefined;
	gridSpacingPx: number;
	/** File > Options > Advanced > "Image Size and Quality" raster-scale multiplier. */
	imageExportScale: number;
	/** Full File > Options snapshot, for Trust Center gates in the canvas mapping. */
	viewerOptions: ViewerOptions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewerBuildingBlocksCore(
	input: UseViewerBuildingBlocksCoreInput,
): ViewerBuildingBlocksCore {
	const { content, canEdit } = input;

	const state = useViewerState({ content, canEdit });
	const {
		containerRef,
		mode,
		slides,
		canvasSize,
		loading,
		error,
		activeSlideIndex,
		selectedElementId,
		selectedElementIds,
		templateElementsBySlideId,
		activeSlide,
		selectedElement,
	} = state;

	const hasActivePointerInteraction = useCallback(
		() =>
			Boolean(
				state.dragStateRef.current ||
				state.resizeStateRef.current ||
				state.marqueeStateRef.current ||
				state.shapeAdjustmentDragStateRef.current ||
				state.isDrawingRef.current,
			),
		[
			state.dragStateRef,
			state.resizeStateRef,
			state.marqueeStateRef,
			state.shapeAdjustmentDragStateRef,
			state.isDrawingRef,
		],
	);

	const zoom = useZoomViewport({ canvasSize, selectedElements: state.selectedElements });

	// Read here (not only inside `PowerPointViewer`) so the headless
	// building-blocks API's undo stack honors Advanced > "Maximum number of
	// undos" too, and "End with black slide" below does the same for
	// presentation setup. Moved above `history`'s construction (originally
	// declared just before `usePresentationSetup`) so both consumers share
	// this one `useViewerOptions()` call/store instance.
	const { options: viewerOptions } = useViewerOptions();

	const history = useEditorHistory({
		slides,
		canvasSize,
		activeSlideIndex,
		templateElementsBySlideId,
		selectedElementId,
		selectedElementIds,
		editTemplateMode: state.editTemplateMode,
		headerFooter: state.headerFooter,
		loading,
		error,
		maxHistoryEntries: resolveHistoryDepth(viewerOptions),
		hasActivePointerInteraction,
		pointerCommitNonce: state.pointerCommitNonce,
		setSlides: state.setSlides,
		setCanvasSize: state.setCanvasSize,
		setActiveSlideIndex: state.setActiveSlideIndex,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		setSelectedElementId: state.setSelectedElementId,
		setSelectedElementIds: state.setSelectedElementIds,
		setEditTemplateMode: state.setEditTemplateMode,
		setHeaderFooter: state.setHeaderFooter,
	});

	const { gridSpacingPx, visibleSlideIndexes, masterPseudoSlide } = useDerivedSlideState({
		slides,
		sections: state.sections,
		customShows: state.customShows,
		activeCustomShowId: state.activeCustomShowId,
		mode,
		activeLayout: state.activeLayout,
		activeMaster: state.activeMaster,
		documentGridSpacing: state.viewProperties?.gridSpacing,
	});

	const { presentation, annotations, actionSoundHandlerRef, setExitModeHandler } =
		usePresentationSetup({
			mode,
			slides,
			visibleSlideIndexes,
			endWithBlackSlide: viewerOptions.advanced.slideShowEndWithBlackSlide,
			// File > Options > Advanced > "Prompt to keep ink annotations when
			// exiting" / "Show popup toolbar" while presenting.
			promptKeepInkAnnotations: viewerOptions.advanced.slideShowPromptKeepInkAnnotations,
			popupToolbarEnabled: viewerOptions.advanced.slideShowShowPopupToolbar,
			activeSlideIndex,
			containerRef,
			content,
			mediaDataUrls: state.mediaDataUrls,
			presentationProperties: state.presentationProperties,
			setMode: state.setMode,
			setActiveSlideIndex: state.setActiveSlideIndex,
			setSlides: state.setSlides,
			history,
			// PowerPoint's bare `J` during a show toggles live captions.
			onToggleSubtitles: () =>
				state.setPresentationProperties((prev) => ({
					...prev,
					showSubtitles: !prev.showSubtitles,
				})),
		});

	return {
		state,
		mode,
		slides,
		loading,
		error,
		activeSlideIndex,
		activeSlide,
		selectedElement,
		zoom,
		history,
		presentation,
		annotations,
		actionSoundHandlerRef,
		setExitModeHandler,
		masterPseudoSlide,
		gridSpacingPx,
		// Multiplied against the pre-existing 2x baseline; see the matching
		// comment in `PowerPointViewer.tsx`.
		imageExportScale: 2 * resolveImageResolutionScale(viewerOptions),
		viewerOptions,
	};
}
