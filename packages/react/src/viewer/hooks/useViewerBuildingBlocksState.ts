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
import type { EditorOperationsResult } from './useEditorOperations';
import { useEditorOperations } from './useEditorOperations';
import type { ExportHandlersResult } from './useExportHandlers';
import type { PrintHandlersResult } from './usePrintHandlers';
import type { PropertyHandlersResult } from './usePropertyHandlers';
import type { ViewerBuildingBlocksCore } from './useViewerBuildingBlocksCore';
import type { ViewerDialogsResult } from './useViewerDialogs';
import { useViewerDialogs } from './useViewerDialogs';
import { useViewerIntegration } from './useViewerIntegration';

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
		canEdit,
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
	};
}
