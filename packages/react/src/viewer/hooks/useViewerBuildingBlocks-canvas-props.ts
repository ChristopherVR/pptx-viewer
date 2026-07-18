import type { PptxAction, PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { SlideCanvasProps, ZoomViewport } from '../components/canvas/canvas-types';
import type { CanvasSize, TableCellEditorState, ViewerMode } from '../types';
import { safeOpenUrl, isPpactionUrl, parsePpactionUrl } from '../utils/hyperlink-security';
import type { TableStyleContext } from '../utils/table-parse';
import type { FieldSubstitutionContext } from '../utils/text-field-substitution';
import type { CanvasInteractionHandlers } from './useCanvasInteractions';
import type { InsertElementHandlers } from './useInsertElements';
import type { UsePresentationModeResult } from './usePresentationMode';
import type { TableOperationHandlers } from './useTableOperations';
import type { ViewerState } from './useViewerState';

/**
 * Pure mapping function that reproduces the `<SlideCanvas ... />` prop
 * wiring from `ViewerCanvasArea.tsx` (the JSX block PowerPointViewer renders
 * internally). Kept as a plain function, not a hook, so it can be called
 * from any composing hook; callers own memoisation if they need it.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface BuildCanvasPropsInput {
	mode: ViewerMode;
	canEdit: boolean;
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	masterPseudoSlide: PptxSlide | undefined;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	activeSlideIndex: number;
	gridSpacingPx: number;
	zoom: ZoomViewport;
	state: ViewerState;
	selectedElement: PptxElement | null;
	canvasHandlers: CanvasInteractionHandlers;
	insertHandlers: InsertElementHandlers;
	tableOps: TableOperationHandlers;
	presentation: UsePresentationModeResult;
	findResults?: SlideCanvasProps['findResults'];
	findResultIndex?: number;
}

// ---------------------------------------------------------------------------
// Mapping function
// ---------------------------------------------------------------------------

export function buildCanvasProps(input: BuildCanvasPropsInput): SlideCanvasProps {
	const {
		mode,
		canEdit,
		slides,
		activeSlide,
		masterPseudoSlide,
		templateElements,
		canvasSize,
		activeSlideIndex,
		gridSpacingPx,
		zoom,
		state: s,
		selectedElement,
		canvasHandlers,
		insertHandlers,
		tableOps,
		presentation,
		findResults,
		findResultIndex,
	} = input;

	const effectiveSlide = mode === 'master' ? masterPseudoSlide : activeSlide;
	const effectiveTemplateElements =
		mode === 'master' ? (s.activeLayout ? (s.activeMaster?.elements ?? []) : []) : templateElements;

	// ── Field substitution context (slide title, header/footer, etc.) ────
	let slideTitle: string | undefined;
	if (activeSlide) {
		for (const el of activeSlide.elements) {
			const phType = (el as unknown as { placeholderType?: string }).placeholderType;
			if (phType === 'title' || phType === 'ctrTitle') {
				const txt = (el as unknown as { text?: string }).text;
				if (txt) {
					slideTitle = txt;
					break;
				}
			}
		}
	}
	const hf = s.headerFooter;
	const fieldContext: FieldSubstitutionContext = {
		slideNumber: activeSlide?.slideNumber,
		dateTimeText: hf.dateTimeText,
		dateFormat: hf.dateFormat,
		footerText: hf.footerText,
		headerText: hf.headerText,
		slideTitle,
		customProperties: s.customProperties.map((p) => ({ name: p.name, value: p.value })),
	};

	// ── Table style context (theme + table style map for band colours) ──
	const tableStyleContext: TableStyleContext | undefined =
		s.theme || s.tableStyleMap ? { theme: s.theme, tableStyleMap: s.tableStyleMap } : undefined;

	// ── Action / hyperlink handlers ────────────────────────────────────
	const handleActionClick = (_elementId: string, action: PptxAction) => {
		if (mode === 'present') {
			presentation.handlePresentationAction(action);
		} else if (action.url) {
			safeOpenUrl(action.url);
		}
	};

	const handleHyperlinkClick = (url: string) => {
		if (isPpactionUrl(url)) {
			if (mode === 'present') {
				const parsed = parsePpactionUrl(url);
				if (parsed) {
					presentation.handlePresentationAction({
						action: parsed.action,
						targetSlideIndex: parsed.targetSlideIndex,
					});
				}
			}
			return;
		}
		safeOpenUrl(url);
	};

	return {
		activeSlide: effectiveSlide,
		templateElements: effectiveTemplateElements,
		canvasSize,
		zoom,
		mode,
		canEdit,
		editTemplateMode: mode === 'master' || s.editTemplateMode,
		selectedElementIdSet: s.selectedElementIdSet,
		selectedElement,
		inlineEditingElementId: s.inlineEditingElementId,
		inlineEditingText: s.inlineEditingText,
		spellCheckEnabled: s.spellCheckEnabled,
		mediaDataUrls: s.mediaDataUrls,
		tableEditorState: s.tableEditorState,
		marqueeSelectionState: s.marqueeSelectionState,
		snapLines: s.snapLines,
		showGrid: s.showGrid,
		gridSpacingPx,
		showRulers: s.showRulers,
		guides: s.guides,
		presentationElementStates:
			mode === 'present' ? presentation.presentationElementStates : undefined,
		presentationKeyframesCss:
			mode === 'present' ? presentation.presentationKeyframesCss : undefined,
		onClick: canvasHandlers.handleElementClick,
		onDoubleClick: canvasHandlers.handleElementDoubleClick,
		onMouseDown: canvasHandlers.handleElementMouseDown,
		onContextMenu: canvasHandlers.handleElementContextMenu,
		onCanvasMouseDown: canvasHandlers.handleCanvasMouseDown,
		onResizePointerDown: canvasHandlers.handleResizePointerDown,
		onAdjustmentPointerDown: canvasHandlers.handleAdjustmentPointerDown,
		onRotate: canvasHandlers.handleRotate,
		onInlineEditChange: s.setInlineEditingText,
		onInlineEditCommit: canvasHandlers.handleInlineEditCommit,
		onInlineEditCancel: () => s.setInlineEditingElementId(null),
		onTableCellSelect: (cell, elementId) =>
			s.setTableEditorState(cell ? ({ ...cell, elementId } as TableCellEditorState) : null),
		onCommitCellEdit: tableOps.handleCommitCellEdit,
		onUpdateSmartArtElement: canvasHandlers.handleUpdateSmartArtElement,
		onFormatText: canvasHandlers.handleFormatText,
		onResizeTableColumns: tableOps.handleResizeTableColumns,
		onResizeTableRow: tableOps.handleResizeTableRow,
		findResults,
		findResultIndex,
		activeSlideIndex,
		activeTool: s.activeTool,
		drawingColor: s.drawingColor,
		drawingWidth: s.drawingWidth,
		isDrawingRef: s.isDrawingRef,
		onAddInkElement: insertHandlers.handleAddInkElement,
		onAddFreeformShape: insertHandlers.handleAddFreeformShape,
		onEraseInkElement: insertHandlers.handleEraseInkElement,
		onActionClick: handleActionClick,
		onHyperlinkClick: handleHyperlinkClick,
		allSlides: mode === 'present' ? slides : undefined,
		onZoomClick: mode === 'present' ? presentation.handleZoomClick : undefined,
		sourceSlideIndex: mode === 'present' ? activeSlideIndex : undefined,
		fieldContext,
		tableStyleContext,
		// Collaboration cursor/selection overlays require a `CollaborationProvider`
		// ancestor, which these building blocks intentionally don't render (hosts
		// that need collaboration should use `PowerPointViewer` directly).
		collaborationOverlay: undefined,
		comments: activeSlide?.comments,
		showCommentMarkers: s.sidebarPanelMode === 'comments',
		onCommentMarkerClick: () => s.setSidebarPanelMode('comments'),
		onMoveGuide: (guideId, position) => {
			s.setGuides((prev) =>
				prev.map((guide) =>
					guide.id === guideId
						? {
								...guide,
								position:
									guide.axis === 'h'
										? Math.max(0, Math.min(canvasSize.height, position))
										: Math.max(0, Math.min(canvasSize.width, position)),
							}
						: guide,
				),
			);
		},
		onDeleteGuide: (guideId) => {
			s.setGuides((prev) => prev.filter((guide) => guide.id !== guideId));
		},
		onCreateGuideFromRuler: (axis, positionPx) => {
			s.setGuides((prev) => [
				...prev,
				{
					id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					axis,
					position: positionPx,
				},
			]);
		},
	};
}
