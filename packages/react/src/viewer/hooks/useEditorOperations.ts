import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { PptxHandler, PptxSlide, PptxElement, TextStyle } from 'pptx-viewer-core';
/**
 * useEditorOperations — Composes all editor-interaction hooks (element ops,
 * section ops, find/replace, comments, canvas interactions, insert, manipulate,
 * slide management, table operations) into a single return value.
 */
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { ViewerMode, CanvasSize } from '../types';
import type { CopiedFormat } from '../utils/format-painter';
import { copyFormatFromElement, applyFormatToElement } from '../utils/format-painter';
import { useCanvasInteractions } from './useCanvasInteractions';
import type { CanvasInteractionHandlers } from './useCanvasInteractions';
import { useComments } from './useComments';
import type { EditorHistoryResult } from './useEditorHistory';
import { useElementManipulation } from './useElementManipulation';
import type { ElementManipulationHandlers } from './useElementManipulation';
import { useElementOperations } from './useElementOperations';
import type { ElementOperations } from './useElementOperations';
import { useFindReplace } from './useFindReplace';
import { useInsertElements } from './useInsertElements';
import type { InsertElementHandlers } from './useInsertElements';
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
	slideOps: SlideManagementHandlers;
	tableOps: TableOperationHandlers;
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
	} = input;

	const ops = useElementOperations({
		slides,
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		templateElementsBySlideId: state.templateElementsBySlideId,
		history,
		setSlides: state.setSlides,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		setSelectedElementId: state.setSelectedElementId,
		setSelectedElementIds: state.setSelectedElementIds,
		setInlineEditingElementId: state.setInlineEditingElementId,
		setContextMenuState: state.setContextMenuState,
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
		setInlineEditingElementId: state.setInlineEditingElementId,
		setInlineEditingText: state.setInlineEditingText,
		setContextMenuState: state.setContextMenuState,
		setMarqueeSelectionState: state.setMarqueeSelectionState,
		setSnapLines: state.setSnapLines,
		inlineEditingText: state.inlineEditingText,
		ops,
		history,
		presentationHandleAction: presentation.handlePresentationAction,
		setEditingEquationOmml: dialogs.setEditingEquationOmml,
		setIsEquationDialogOpen: dialogs.setIsEquationDialogOpen,
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

	const manipulation = useElementManipulation({
		activeSlide,
		activeSlideIndex,
		selectedElement,
		effectiveSelectedIds: state.effectiveSelectedIds,
		selectedElements: state.selectedElements,
		selectedElementIdSet: state.selectedElementIdSet,
		elementLookup: state.elementLookup,
		editTemplateMode: state.editTemplateMode,
		clipboardPayload: state.clipboardPayload,
		setClipboardPayload: state.setClipboardPayload,
		setSelectedElementIds: state.setSelectedElementIds,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		setIsInspectorPaneOpen: state.setIsInspectorPaneOpen,
		setSidebarPanelMode: state.setSidebarPanelMode,
		ops,
		history,
		onOpenHyperlinkDialog: () => dialogs.setIsHyperlinkDialogOpen(true),
	});

	const slideOps = useSlideManagement({
		slides,
		activeSlide,
		activeSlideIndex,
		setActiveSlideIndex: state.setActiveSlideIndex,
		ops,
		history,
		handlerRef,
	});

	const tableOps = useTableOperations({
		selectedElement,
		elementLookup: state.elementLookup,
		tableEditorState: state.tableEditorState,
		setTableEditorState: state.setTableEditorState,
		ops,
		history,
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
	// Capture formatting from the selected element when the painter is activated.
	// The toolbar toggle sets formatPainterActive; this effect reacts to it.
	const copiedFormatRef = useRef<CopiedFormat | null>(null);
	const prevFormatPainterRef = useRef(false);
	const { formatPainterActive, setFormatPainterActive, elementLookup } = state;

	useEffect(() => {
		if (formatPainterActive && !prevFormatPainterRef.current && selectedElement) {
			copiedFormatRef.current = copyFormatFromElement(selectedElement);
		} else if (!formatPainterActive) {
			copiedFormatRef.current = null;
		}
		prevFormatPainterRef.current = formatPainterActive;
	}, [formatPainterActive, selectedElement]);

	// Escape cancels the painter without applying.
	useEffect(() => {
		if (!formatPainterActive) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setFormatPainterActive(false);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [formatPainterActive, setFormatPainterActive]);

	// Wrap canvas handlers to:
	//  - apply copied format on element click when painter is active;
	//  - cancel painter when the user mousedowns on empty canvas.
	const formatPainterCanvasHandlers: CanvasInteractionHandlers = useMemo(
		() => ({
			...canvasHandlers,
			handleElementClick: (elementId: string, e: React.MouseEvent) => {
				if (formatPainterActive && copiedFormatRef.current) {
					e.stopPropagation();
					const element = elementLookup.get(elementId);
					if (element) {
						const updated = applyFormatToElement(element, copiedFormatRef.current);
						const updates: Partial<PptxElement> = {};
						if (hasShapeProperties(updated)) {
							(updates as { shapeStyle?: unknown }).shapeStyle = updated.shapeStyle;
						}
						if (hasTextProperties(updated)) {
							(updates as { textStyle?: unknown }).textStyle = updated.textStyle;
						}
						ops.updateElementById(elementId, updates);
					}
					copiedFormatRef.current = null;
					setFormatPainterActive(false);
					ops.applySelection(elementId);
					return;
				}
				canvasHandlers.handleElementClick(elementId, e);
			},
			handleCanvasMouseDown: (e: React.MouseEvent) => {
				if (formatPainterActive) {
					setFormatPainterActive(false);
					return;
				}
				canvasHandlers.handleCanvasMouseDown(e);
			},
		}),
		[canvasHandlers, ops, formatPainterActive, setFormatPainterActive, elementLookup],
	);

	return {
		ops: combinedOps,
		sectionOps,
		findReplace,
		comments,
		canvasHandlers: formatPainterCanvasHandlers,
		insertHandlers,
		manipulation,
		slideOps,
		tableOps,
	};
}
