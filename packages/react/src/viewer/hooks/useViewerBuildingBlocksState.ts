/**
 * useViewerBuildingBlocksState: The dialogs / editor-operations /
 * integration half of `useViewerBuildingBlocks`'s hook wiring, split out
 * (alongside `useViewerBuildingBlocksCore.ts`) to keep every file under the
 * project's per-file line limit.
 *
 * Consumes `useViewerBuildingBlocksCore`'s return value and calls the exact
 * same remaining hooks, in the exact same order/wiring, that
 * `PowerPointViewer.tsx` uses: dialogs, the slide-change selection-clear
 * effect, `useEditorOperations`, and `useViewerIntegration` (export/print/
 * property handlers, mode switching, and the imperative handle).
 */
import { useEffect } from 'react';

import type { PowerPointViewerHandle } from '../types';
import type { ViewerMode } from '../types-core';
import type { AutosaveStatus } from './useAutosave';
import { useCompatibilityToastsState } from './useCompatibilityToastsState';
import type { EditorOperationsResult } from './useEditorOperations';
import { useEditorOperations } from './useEditorOperations';
import type { ExportHandlersResult } from './useExportHandlers';
import type { PrintHandlersResult } from './usePrintHandlers';
import type { PropertyHandlersResult } from './usePropertyHandlers';
import { useReadOnlyRecommendationState } from './useReadOnlyRecommendationState';
import type { ViewerBuildingBlocksCore } from './useViewerBuildingBlocksCore';
import type { ViewerDialogsResult } from './useViewerDialogs';
import { useViewerDialogs } from './useViewerDialogs';
import { useViewerIntegration } from './useViewerIntegration';
import type { UseViewPreferencesSyncResult } from './useViewPreferencesSync';
import { useViewPreferencesSync } from './useViewPreferencesSync';

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface UseViewerBuildingBlocksStateInput {
	/** Output of `useViewerBuildingBlocksCore`, called just before this hook. */
	core: ViewerBuildingBlocksCore;
	content: ArrayBuffer | Uint8Array | null;
	canEdit: boolean;
	filePath?: string;
	autosaveEnabled: boolean;
	userName?: string;
	handle?: React.ForwardedRef<PowerPointViewerHandle>;
	setContent: React.Dispatch<React.SetStateAction<ArrayBuffer | Uint8Array | null>>;
	onContentChange?: (content: Uint8Array) => void;
	onDirtyChange?: (dirty: boolean) => void;
	onActiveSlideChange?: (index: number) => void;
	onModeChange?: (mode: ViewerMode) => void;
	onZoomChange?: (zoom: number) => void;
	onSelectionChange?: (ids: string[]) => void;
	onSlideCountChange?: (count: number) => void;
}

export interface ViewerBuildingBlocksState {
	dialogs: ViewerDialogsResult;
	editorOps: EditorOperationsResult;
	exportHandlers: ExportHandlersResult;
	printHandlers: PrintHandlersResult;
	propertyHandlers: PropertyHandlersResult;
	handleSetMode: (mode: ViewerMode) => void;
	handleEnterPresenterView: () => void;
	handleEnterRehearsalMode: () => void;
	autosaveStatus: AutosaveStatus;
	/**
	 * Grid/snap/guides toggle handlers that also write the change back into
	 * `state.viewProperties` (see `useViewPreferencesSync`), so a host driving
	 * the standalone `<Toolbar>` off this API's `toolbarProps` gets the same
	 * `ppt/viewProps.xml` round-trip `PowerPointViewer` does.
	 */
	viewPreferencesSync: UseViewPreferencesSyncResult;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewerBuildingBlocksState(
	input: UseViewerBuildingBlocksStateInput,
): ViewerBuildingBlocksState {
	const { core, content, canEdit, filePath, autosaveEnabled, userName, handle, setContent } = input;
	const {
		onContentChange,
		onDirtyChange,
		onActiveSlideChange,
		onModeChange,
		onZoomChange,
		onSelectionChange,
		onSlideCountChange,
	} = input;
	const {
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
		gridSpacingPx,
		imageExportScale,
		setExitModeHandler,
		viewerOptions,
	} = core;

	const dialogs = useViewerDialogs({
		mode,
		slides,
		activeSlide,
		activeSlideIndex,
		canvasSize: state.canvasSize,
		containerRef: state.containerRef,
		customShows: state.customShows,
		activeCustomShowId: state.activeCustomShowId,
		setCustomShows: state.setCustomShows,
		setActiveCustomShowId: state.setActiveCustomShowId,
		setGuides: state.setGuides,
		setPresentationProperties: state.setPresentationProperties,
		setAccessibilityIssues: state.setAccessibilityIssues as unknown as React.Dispatch<
			React.SetStateAction<
				Array<{
					slideIndex: number;
					elementId: string;
					severity: 'error' | 'warning' | 'info';
					message: string;
				}>
			>
		>,
		setIsAccessibilityPanelOpen: state.setIsAccessibilityPanelOpen,
		setMode: state.setMode,
		setPreMasterMode: state.setPreMasterMode,
		setActiveMasterIndex: state.setActiveMasterIndex,
		setActiveLayoutIndex: state.setActiveLayoutIndex,
		setSelectedElementId: state.setSelectedElementId,
		setSelectedElementIds: state.setSelectedElementIds,
		preMasterMode: state.preMasterMode,
		hasDigitalSignatures: state.hasDigitalSignatures,
		isDirty: state.isDirty,
		history,
	});

	// Load-diagnostic state PowerPointViewer also seeds on every load. This
	// headless API renders no banner/toast UI of its own (a host building a
	// custom shell would render one against these), but `useViewerIntegration`
	// still needs somewhere to put the per-load setters.
	const readOnlyRec = useReadOnlyRecommendationState(content);
	const compatToastsState = useCompatibilityToastsState();

	// ── Clear selection on slide change (same effect PowerPointViewer runs) ──
	useEffect(() => {
		state.setSelectedElementId(null);
		state.setSelectedElementIds([]);
		state.setInlineEditingElementId(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSlideIndex]);

	const editorOps = useEditorOperations({
		state,
		history,
		zoom,
		mode,
		canEdit,
		slides,
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId: state.selectedElementId,
		selectedElementIds: state.selectedElementIds,
		canvasSize: state.canvasSize,
		dialogs,
		presentation,
		userName,
		handlerRef: actionSoundHandlerRef,
	});

	const {
		exportHandlers,
		printHandlers,
		propertyHandlers,
		handleSetMode,
		handleEnterPresenterView,
		handleEnterRehearsalMode,
		autosaveStatus,
		loadVersion,
	} = useViewerIntegration({
		state,
		zoom,
		history,
		presentation,
		annotations,
		actionSoundHandlerRef,
		editorOps,
		dialogs,
		gridSpacingPx,
		content,
		filePath,
		autosaveEnabled,
		// Trust Center > "Allow external content": same gate `PowerPointViewer`
		// applies, so the headless building-blocks API loads http(s) images
		// under the same default-off, core-side SSRF/privacy guard.
		allowExternalImages: viewerOptions.trust.allowExternalContent,
		setReadOnlyRecommendation: readOnlyRec.setRecommendation,
		setModifyVerifier: readOnlyRec.setModifyVerifier,
		setCompatToasts: compatToastsState.setToasts,
		canEdit,
		promptKeepInkAnnotations: viewerOptions.advanced.slideShowPromptKeepInkAnnotations,
		imageExportScale,
		mode,
		slides,
		activeSlide,
		activeSlideIndex,
		canvasSize: state.canvasSize,
		loading,
		error,
		ref: handle ?? null,
		setContent,
		onContentChange,
		onDirtyChange,
		onActiveSlideChange,
		onModeChange,
		onZoomChange,
		onSelectionChange,
		onSlideCountChange,
	});

	// Route keyboard/end-of-show exits through the same keep/discard-ink dialog
	// as the toolbar's exit button (see `usePresentationSetup.setExitModeHandler`).
	setExitModeHandler(handleSetMode);

	const viewPreferencesSync = useViewPreferencesSync({
		loadVersion,
		viewProperties: state.viewProperties,
		setViewProperties: state.setViewProperties,
		snapToGrid: state.snapToGrid,
		setSnapToGrid: state.setSnapToGrid,
		snapToShape: state.snapToShape,
		setSnapToShape: state.setSnapToShape,
		showGuides: state.showGuides,
		setShowGuides: state.setShowGuides,
	});

	return {
		dialogs,
		editorOps,
		exportHandlers,
		printHandlers,
		propertyHandlers,
		handleSetMode,
		handleEnterPresenterView,
		handleEnterRehearsalMode,
		autosaveStatus,
		viewPreferencesSync,
	};
}
