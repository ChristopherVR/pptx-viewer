import type { PptxAction, PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { ViewerOptions } from 'pptx-viewer-shared';
import {
	buildFieldSubstitutionContext,
	resolvePresentationAction,
	shouldConfirmExternalHyperlink,
} from 'pptx-viewer-shared';

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
	/** Live File > Options snapshot, for the Trust Center hyperlink-confirm gate. */
	viewerOptions: ViewerOptions;
	/**
	 * Confirmation prompt text for `window.confirm`, pre-built by the caller
	 * (a hook, so it can call `useTranslation`) as
	 * `` `${t('pptx.options.trust.confirmHyperlinks')}\n\n${url}` ``. Only
	 * invoked when `shouldConfirmExternalHyperlink` says the gate applies.
	 */
	buildHyperlinkConfirmMessage: (url: string) => string;
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
		viewerOptions,
		buildHyperlinkConfirmMessage,
	} = input;

	const effectiveSlide = mode === 'master' ? masterPseudoSlide : activeSlide;
	const effectiveTemplateElements =
		mode === 'master' ? (s.activeLayout ? (s.activeMaster?.elements ?? []) : []) : templateElements;

	// ── Field substitution context (slide title, header/footer, etc.) ────
	// Assembled by `pptx-viewer-shared` so all five bindings resolve fields
	// identically. In particular the slide title now comes from core's
	// `deriveSlideTitle`: the `placeholderType` property this used to scan for
	// is never set on a parsed deck, so `slidetitle` fields silently kept their
	// cached literal ("Title") on every real `.pptx`.
	const fieldContext: FieldSubstitutionContext = buildFieldSubstitutionContext({
		headerFooter: s.headerFooter,
		customProperties: s.customProperties,
		slide: activeSlide,
	});

	// ── Table style context (theme + table style map for band colours) ──
	const tableStyleContext: TableStyleContext | undefined =
		s.theme || s.tableStyleMap ? { theme: s.theme, tableStyleMap: s.tableStyleMap } : undefined;

	// ── Action / hyperlink handlers ────────────────────────────────────
	// Trust Center gate: external http(s) links may require confirmation
	// before opening (Options > Trust Center > confirm external hyperlinks),
	// same as `ViewerCanvasArea`'s wiring for the packaged `PowerPointViewer`.
	const openExternalUrl = (url: string) => {
		if (
			shouldConfirmExternalHyperlink(viewerOptions, url) &&
			!window.confirm(buildHyperlinkConfirmMessage(url))
		) {
			return;
		}
		safeOpenUrl(url);
	};

	const handleActionClick = (_elementId: string, action: PptxAction) => {
		if (mode === 'present') {
			// `runPresentationAction` (inside `handlePresentationAction`) opens an
			// action's own external hyperlink unconditionally: it has no host hook
			// for the Trust Center gate. Resolve the action here first so an
			// `openUrl` intent goes through `openExternalUrl`'s confirm check
			// instead.
			const resolved = resolvePresentationAction(action, { slideCount: slides.length });
			if (resolved.intent.kind === 'openUrl') {
				openExternalUrl(resolved.intent.url);
				return;
			}
			presentation.handlePresentationAction(action);
		} else if (action.url) {
			openExternalUrl(action.url);
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
		openExternalUrl(url);
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
		// View ▸ Guides hides the overlay without discarding the guides: they are
		// still snapped to while dragging and still round-trip on save.
		guides: s.showGuides ? s.guides : [],
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
