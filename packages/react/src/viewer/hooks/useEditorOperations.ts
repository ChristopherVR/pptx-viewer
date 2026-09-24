import type { PptxHandler, PptxSlide, PptxElement, TextStyle } from 'pptx-viewer-core';
/**
 * useEditorOperations: Composes all editor-interaction hooks (element ops,
 * section ops, find/replace, comments, canvas interactions, insert, manipulate,
 * slide management, table operations, format painter) into a single return value.
 */
import { downloadBlob, elementPictureFilename, rasterResultToPngBlob } from 'pptx-viewer-shared';
import type React from 'react';
import { useCallback, useMemo } from 'react';

import type { ViewerMode, CanvasSize } from '../types';
import { renderElementToRaster } from '../utils/export-helpers';
import { useCanvasImagePaste } from './useCanvasImagePaste';
import { useCanvasInteractions } from './useCanvasInteractions';
import type { CanvasInteractionHandlers } from './useCanvasInteractions';
import { useComments } from './useComments';
import type { EditorHistoryResult } from './useEditorHistory';
import { useElementManipulation } from './useElementManipulation';
import type { ElementManipulationHandlers } from './useElementManipulation';
import { useElementOperations } from './useElementOperations';
import type { ElementOperations } from './useElementOperations';
import { useFindReplace } from './useFindReplace';
import { useFormatPainterEditing } from './useFormatPainterEditing';
import { useInsertElements } from './useInsertElements';
import type { InsertElementHandlers } from './useInsertElements';
import { usePasteSpecial } from './usePasteSpecial';
import type { UsePasteSpecialResult } from './usePasteSpecial';
import type { UsePresentationModeResult } from './usePresentationMode';
import { useSectionOperations } from './useSectionOperations';
import type { SectionOperations } from './useSectionOperations';
import { useSlideManagement } from './useSlideManagement';
import type { SlideManagementHandlers } from './useSlideManagement';
import { useTableOperations } from './useTableOperations';
import type { TableOperationHandlers } from './useTableOperations';
import type { ViewerDialogsResult } from './useViewerDialogs';
import type { ViewerState } from './useViewerState';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseEditorOperationsInput {
	state: ViewerState;
	history: EditorHistoryResult;
	zoom: {
		editorScale: number;
		canvasStageRef: React.RefObject<HTMLDivElement | null>;
	};
	mode: ViewerMode;
	canEdit: boolean;
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	selectedElementId: string | null;
	selectedElementIds: string[];
	canvasSize: CanvasSize;
	dialogs: ViewerDialogsResult;
	presentation: UsePresentationModeResult;
	/** Display name for comment authoring. */
	userName?: string;
	/** Ref to the loaded PPTX handler; populated by the content-lifecycle hook. */
	handlerRef?: React.RefObject<PptxHandler | null> | React.MutableRefObject<PptxHandler | null>;
	/** AutoCorrect transform applied to committed inline text edits. */
	transformCommittedText?: (text: string) => string;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface EditorOperationsResult {
	ops: ElementOperations;
	sectionOps: SectionOperations;
	findReplace: ReturnType<typeof useFindReplace>;
	comments: ReturnType<typeof useComments>;
	canvasHandlers: CanvasInteractionHandlers;
	insertHandlers: InsertElementHandlers;
	manipulation: ElementManipulationHandlers;
	/** Paste Special (Ctrl+Alt+V) dialog + the post-paste Paste Options toolbar. */
	pasteSpecial: UsePasteSpecialResult;
	slideOps: SlideManagementHandlers;
	tableOps: TableOperationHandlers;
	/**
	 * Ctrl/Cmd+Shift+C: copy the selected element's format, the same capture
	 * the format-painter ribbon toggle triggers, without requiring a
	 * follow-up click to apply it.
	 */
	copyFormatFromSelection: () => void;
	/**
	 * Ctrl/Cmd+Shift+V: apply whatever format `copyFormatFromSelection` (or the
	 * ribbon's format painter) captured onto every given element id, then
	 * clear the copied format the same way the click-to-apply path does.
	 */
	pasteFormatToSelection: (targetIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorOperations(input: UseEditorOperationsInput): EditorOperationsResult {
	const {
		state,
		history,
		zoom,
		mode,
		canEdit,
		slides,
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		selectedElementIds,
		canvasSize,
		dialogs,
		presentation,
		userName,
		handlerRef,
		transformCommittedText,
	} = input;

	// View > Slide Master edits a part that is not in `slides`, so element
	// writes have to be routed to the master/layout/notes/handout model while
	// the view is open. `null` outside master mode keeps the slide path.
	const masterView = useMemo(
		() => ({
			target:
				mode === 'master'
					? {
							tab: state.masterViewTab,
							masterIndex: state.activeMasterIndex,
							layoutIndex: state.activeLayoutIndex,
						}
					: null,
			slideMasters: state.slideMasters,
			notesMaster: state.notesMaster,
			handoutMaster: state.handoutMaster,
			setSlideMasters: state.setSlideMasters,
			setNotesMaster: state.setNotesMaster,
			setHandoutMaster: state.setHandoutMaster,
		}),
		[
			mode,
			state.masterViewTab,
			state.activeMasterIndex,
			state.activeLayoutIndex,
			state.slideMasters,
			state.notesMaster,
			state.handoutMaster,
			state.setSlideMasters,
			state.setNotesMaster,
			state.setHandoutMaster,
		],
	);

	const ops = useElementOperations({
		slides,
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		editTemplateMode: state.editTemplateMode,
		templateElements: state.templateElements,
		masterView,
		history,
		setSlides: state.setSlides,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		setSelectedElementId: state.setSelectedElementId,
		setSelectedElementIds: state.setSelectedElementIds,
		setInlineEditingElementId: state.setInlineEditingElementId,
		setContextMenuState: state.setContextMenuState,
		inlineEditingElementId: state.inlineEditingElementId,
		inlineEditingText: state.inlineEditingText,
		inlineEditingSnapshotRef: state.inlineEditingSnapshotRef,
	});

	const sectionOps = useSectionOperations({
		sections: state.sections,
		setSections: state.setSections,
		slides,
		setSlides: state.setSlides,
		markDirty: history.markDirty,
	});

	const findReplace = useFindReplace({
		slides,
		mode,
		onSetActiveSlideIndex: state.setActiveSlideIndex,
		onSetSelectedElementId: state.setSelectedElementId,
		onUpdateSlides: ops.updateSlides,
		onMarkDirty: history.markDirty,
	});

	const comments = useComments({
		slides,
		activeSlideIndex,
		canEdit,
		userName,
		selectedElementId: state.selectedElementId,
		onUpdateSlides: ops.updateSlides,
		onMarkDirty: history.markDirty,
	});

	const canvasHandlers = useCanvasInteractions({
		mode,
		canEdit,
		canvasSize,
		activeSlideIndex,
		selectedElementId,
		selectedElementIds,
		selectedElementIdSet: state.selectedElementIdSet,
		inlineEditingElementId: state.inlineEditingElementId,
		effectiveSelectedIds: state.effectiveSelectedIds,
		elementLookup: state.elementLookup,
		activeTool: state.activeTool,
		editTemplateMode: state.editTemplateMode,
		editorScale: zoom.editorScale,
		canvasStageRef: zoom.canvasStageRef,
		dragStateRef: state.dragStateRef,
		resizeStateRef: state.resizeStateRef,
		shapeAdjustmentDragStateRef: state.shapeAdjustmentDragStateRef,
		marqueeStateRef: state.marqueeStateRef,
		justInteractedRef: state.justInteractedRef,
		setInlineEditingElementId: state.setInlineEditingElementId,
		setInlineEditingText: state.setInlineEditingText,
		setContextMenuState: state.setContextMenuState,
		setMarqueeSelectionState: state.setMarqueeSelectionState,
		setSnapLines: state.setSnapLines,
		inlineEditingText: state.inlineEditingText,
		inlineEditingSnapshotRef: state.inlineEditingSnapshotRef,
		ops,
		inlineEditingTextRef: state.inlineEditingTextRef,
		inlineEditingReaderRef: state.inlineEditingReaderRef,
		history,
		presentationHandleAction: presentation.handlePresentationAction,
		setEditingEquationOmml: dialogs.setEditingEquationOmml,
		setIsEquationDialogOpen: dialogs.setIsEquationDialogOpen,
		setPointerCommitNonce: state.setPointerCommitNonce,
		transformCommittedText,
	});

	const insertHandlers = useInsertElements({
		activeSlide,
		activeSlideIndex,
		canvasSize,
		newShapeType: state.newShapeType,
		selectedElements: state.selectedElements,
		ops,
		history,
	});
	const imagePaste = useCanvasImagePaste({
		state,
		mode,
		canEdit,
		handlerRef,
		insertElement: insertHandlers.addElement,
	});

	// "Edit Text" from the element context menu is the same effect as
	// double-clicking the element: `handleElementDoubleClick` already ignores
	// its event argument, so a synthetic empty one is safe here.
	const handleEditTextFromContextMenu = useCallback(
		(elementId: string) => {
			canvasHandlers.handleElementDoubleClick(elementId, {} as React.MouseEvent);
		},
		[canvasHandlers],
	);

	// "Save as Picture": rasterise just the right-clicked element's own DOM
	// node (found via the same `data-element-id` marker the canvas event
	// delegation uses) and download it, reusing the shared raster/download
	// pipeline every other export button already goes through.
	const handleSaveElementAsPicture = useCallback(
		(elementId: string) => {
			const node = document.querySelector<HTMLElement>(
				`[data-element-id="${elementId}"][data-pptx-element="true"]`,
			);
			if (!node) {
				return;
			}
			void (async () => {
				const result = await renderElementToRaster(node, 2);
				const blob = await rasterResultToPngBlob(result);
				const el = state.elementLookup.get(elementId);
				downloadBlob(blob, elementPictureFilename(el?.name, 'Picture'));
			})();
		},
		[state.elementLookup],
	);

	const pasteSpecial = usePasteSpecial({
		clipboardPayload: state.clipboardPayload,
		editTemplateMode: state.editTemplateMode,
		ops,
		markDirty: history.markDirty,
	});

	const manipulation = useElementManipulation({
		activeSlide,
		activeSlideIndex,
		selectedElement,
		effectiveSelectedIds: state.effectiveSelectedIds,
		selectedElements: state.selectedElements,
		selectedElementIdSet: state.selectedElementIdSet,
		elementLookup: state.elementLookup,
		editTemplateMode: state.editTemplateMode,
		canvasSize,
		clipboardPayload: state.clipboardPayload,
		setClipboardPayload: state.setClipboardPayload,
		setSelectedElementIds: state.setSelectedElementIds,
		setIsInspectorPaneOpen: state.setIsInspectorPaneOpen,
		setSidebarPanelMode: state.setSidebarPanelMode,
		ops,
		history,
		onOpenHyperlinkDialog: () => dialogs.setIsHyperlinkDialogOpen(true),
		onEditText: handleEditTextFromContextMenu,
		onSaveElementAsPicture: handleSaveElementAsPicture,
		onPasted: pasteSpecial.notePastedElement,
	});

	const slideOps = useSlideManagement({
		slides,
		activeSlide,
		activeSlideIndex,
		setActiveSlideIndex: state.setActiveSlideIndex,
		ops,
		history,
		handlerRef,
		canvasSize,
		theme: state.theme,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
	});

	const tableOps = useTableOperations({
		selectedElement,
		elementLookup: state.elementLookup,
		tableEditorState: state.tableEditorState,
		setTableEditorState: state.setTableEditorState,
		ops,
		history,
		transformCommittedText,
	});

	// Combined text style updater: if a table cell is active, apply formatting
	// to that cell; otherwise delegate to the normal element text style updater.
	const combinedUpdateTextStyle = useCallback(
		(updates: Partial<TextStyle>) => {
			if (selectedElement?.type === 'table' && state.tableEditorState) {
				tableOps.handleUpdateCellTextStyle(updates as Record<string, unknown>);
				return;
			}
			ops.updateSelectedTextStyle(updates);
		},
		[selectedElement, state.tableEditorState, tableOps, ops],
	);

	const combinedOps: ElementOperations = useMemo(
		() => ({
			...ops,
			updateSelectedTextStyle: combinedUpdateTextStyle,
		}),
		[ops, combinedUpdateTextStyle],
	);

	// ── Format Painter ────────────────────────────────────────────────
	const { formatPainterActive, setFormatPainterActive, elementLookup } = state;
	const {
		canvasHandlers: formatPainterCanvasHandlers,
		copyFormatFromSelection,
		pasteFormatToSelection,
	} = useFormatPainterEditing({
		selectedElement,
		elementLookup,
		formatPainterActive,
		setFormatPainterActive,
		canvasHandlers,
		ops,
	});

	return {
		ops: combinedOps,
		sectionOps,
		findReplace,
		comments,
		canvasHandlers: formatPainterCanvasHandlers,
		insertHandlers: { ...insertHandlers, imagePaste },
		manipulation,
		pasteSpecial,
		slideOps,
		tableOps,
		copyFormatFromSelection,
		pasteFormatToSelection,
	};
}
