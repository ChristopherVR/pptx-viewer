import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	beginShapeAdjustment,
	canInteractWithElement,
	filterInteractableIds,
	resolveInlineEditAutoFitHeight,
	resolveInlineEditNormAutofitShrink,
} from 'pptx-viewer-shared';
/** useCanvasInteractions: Canvas interaction handlers for the PowerPoint editor. */
import { useRef } from 'react';

import type {
	CanvasSize,
	DragState,
	MarqueeSelectionState,
	ResizeState,
	ShapeAdjustmentDragState,
	ShapeAdjustmentHandleDescriptor,
	ElementContextMenuState,
} from '../types';
import type { ViewerMode } from '../types-core';
import { remapTextToSegments } from '../utils/remap-text';
import type { CanvasInteractionHandlers } from './canvas-interaction-types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

export type { CanvasInteractionHandlers } from './canvas-interaction-types';

export interface UseCanvasInteractionsInput {
	mode: ViewerMode;
	canEdit: boolean;
	canvasSize: CanvasSize;
	activeSlideIndex: number;
	selectedElementId: string | null;
	selectedElementIds: string[];
	selectedElementIdSet: Set<string>;
	inlineEditingElementId: string | null;
	effectiveSelectedIds: string[];
	elementLookup: Map<string, PptxElement>;
	activeTool: string;
	editTemplateMode: boolean;
	editorScale: number;
	canvasStageRef: React.RefObject<HTMLDivElement | null>;
	dragStateRef: React.MutableRefObject<DragState | null>;
	resizeStateRef: React.MutableRefObject<ResizeState | null>;
	shapeAdjustmentDragStateRef: React.MutableRefObject<ShapeAdjustmentDragState | null>;
	marqueeStateRef: React.MutableRefObject<MarqueeSelectionState | null>;
	/**
	 * Set by `processPointerUp` when a drag/resize/adjustment gesture just moved
	 * the element; consumed here to tell that gesture's trailing click apart from
	 * a genuine second click on an already-selected element. See
	 * `ViewerCoreState.justInteractedRef`.
	 */
	justInteractedRef: React.MutableRefObject<boolean>;
	setInlineEditingElementId: React.Dispatch<React.SetStateAction<string | null>>;
	setInlineEditingText: React.Dispatch<React.SetStateAction<string>>;
	setContextMenuState: React.Dispatch<React.SetStateAction<ElementContextMenuState | null>>;
	setMarqueeSelectionState: React.Dispatch<React.SetStateAction<MarqueeSelectionState | null>>;
	setSnapLines: React.Dispatch<React.SetStateAction<Array<{ axis: string; position: number }>>>;
	inlineEditingText: string;
	ops: ElementOperations;
	history: EditorHistoryResult;
	presentationHandleAction: (action: Record<string, unknown>) => void;
	setEditingEquationOmml: (omml: Record<string, unknown> | null) => void;
	setIsEquationDialogOpen: (open: boolean) => void;
	/** Bumped after a committed on-canvas edit so the history hook snapshots it. */
	setPointerCommitNonce?: React.Dispatch<React.SetStateAction<number>>;
	/**
	 * Optional transform run over typed text when an inline edit commits
	 * (AutoCorrect, Options > Proofing). Applied only to user-typed commits,
	 * never to programmatic segment remaps.
	 */
	transformCommittedText?: (text: string) => string;
}

/**
 * True when a mousedown on an element should replace the selection and arm a
 * drag.
 *
 * A modifier-click must not: it is a selection *toggle*, and the click handler
 * that follows owns it. While mousedown replaced the selection unconditionally,
 * the click's toggle then saw the just-clicked element as already selected and
 * removed it again, so Shift+click could never build a multi-selection and
 * Ctrl+G had nothing to group.
 */
export function mouseDownStartsSelectionDrag(event: {
	shiftKey: boolean;
	metaKey: boolean;
}): boolean {
	return !event.shiftKey && !event.metaKey;
}

export function useCanvasInteractions(
	input: UseCanvasInteractionsInput,
): CanvasInteractionHandlers {
	const {
		mode,
		canEdit,
		canvasSize,
		selectedElementId,
		selectedElementIds,
		selectedElementIdSet,
		inlineEditingElementId,
		effectiveSelectedIds,
		elementLookup,
		activeTool,
		editorScale,
		canvasStageRef,
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef,
		marqueeStateRef,
		justInteractedRef,
		setInlineEditingElementId,
		setInlineEditingText,
		setContextMenuState,
		setMarqueeSelectionState,
		setSnapLines,
		inlineEditingText,
		ops,
		history,
		presentationHandleAction,
		setEditingEquationOmml,
		setIsEquationDialogOpen,
		setPointerCommitNonce,
		transformCommittedText,
	} = input;

	// Track whether the mouseDown event just selected the element.
	// This prevents the click handler from immediately entering inline editing
	// on the same click that selected the element (which would hide resize handles).
	const justSelectedRef = useRef(false);

	const handleInlineEditCommit = () => {
		const editId = inlineEditingElementId;
		if (!editId) {
			return;
		}
		const el = elementLookup.get(editId);
		if (el && hasTextProperties(el)) {
			// AutoCorrect runs on the typed text before it becomes segments.
			const committedText = transformCommittedText
				? transformCommittedText(inlineEditingText)
				: inlineEditingText;
			const newSegments = remapTextToSegments(committedText, el.textSegments, el.textStyle);
			// `a:spAutoFit` ("Resize shape to fit text"): grow/shrink the shape to
			// the text's natural content height, the way PowerPoint does. The
			// editor's DOM node is still mounted here (the state update below is
			// what unmounts it, and that only takes effect on the next render), so
			// this measures the live, still-focused element rather than a stale
			// snapshot.
			const editorEl = document.querySelector<HTMLElement>('[data-inline-editor]');
			const newHeight = resolveInlineEditAutoFitHeight(el.textStyle, el.height, editorEl);
			// `a:normAutofit` ("Shrink text on overflow"): recompute the font
			// scale/line-spacing reduction so the (possibly now longer or
			// shorter) text still fits the shape, the way PowerPoint does.
			// Mutually exclusive with the `spAutoFit` resize above (both read
			// `autoFitMode`, only one of the two modes is ever set).
			const shrink = resolveInlineEditNormAutofitShrink(el.textStyle, el.height, editorEl);
			ops.updateElementById(editId, {
				text: committedText,
				textSegments: newSegments,
				...(newHeight !== undefined ? { height: newHeight } : {}),
				...(shrink !== 'unchanged'
					? {
							textStyle: {
								...el.textStyle,
								autoFitFontScale: shrink.fontScale,
								autoFitLineSpacingReduction: shrink.lnSpcReduction,
							},
						}
					: {}),
			} as Partial<PptxElement>);
			history.markDirty();
		}
		setInlineEditingElementId(null);
		setInlineEditingText('');
	};

	/**
	 * Route an equation-bearing element to the equation editor dialog instead
	 * of inline text editing. Inline editing an equation element is always
	 * destructive: the contentEditable only sees the "[Equation]" placeholder
	 * text, so the blur commit rebuilds the segments from plain text and the
	 * OMML is lost for good. Returns true when the dialog was opened.
	 */
	const openEquationEditorForElement = (el: PptxElement): boolean => {
		if (!hasTextProperties(el)) {
			return false;
		}
		const eqSeg = el.textSegments?.find((seg) => seg.equationXml);
		if (!eqSeg?.equationXml) {
			return false;
		}
		setEditingEquationOmml(eqSeg.equationXml);
		setIsEquationDialogOpen(true);
		return true;
	};

	const handleElementClick = (elementId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (mode === 'present') {
			const el = elementLookup.get(elementId);
			if (el?.actionClick) {
				presentationHandleAction(el.actionClick as Record<string, unknown>);
			}
			return;
		}
		if (e.shiftKey || e.metaKey) {
			const ids = selectedElementIds.length
				? selectedElementIds
				: selectedElementId
					? [selectedElementId]
					: [];
			const newIds = ids.includes(elementId)
				? ids.filter((id) => id !== elementId)
				: [...ids, elementId];
			ops.applySelection(newIds[0] ?? null, newIds);
		} else if (selectedElementIdSet.has(elementId) && !inlineEditingElementId) {
			// Only enter inline editing if the element was already selected before
			// this mouseDown+click sequence. If justSelectedRef is true, this click
			// was the initial selection click - skip inline editing so resize handles
			// remain visible.
			//
			// justInteractedRef guards a second case: a drag/resize/adjustment
			// gesture that just moved this element ends with the pointer back over
			// the same DOM node it went down on (a dragged shape keeps the same
			// point under the cursor; an SE handle tracks the pointer 1:1), so the
			// browser still fires this `click` even though nothing was "clicked" by
			// the user's intent. Without this guard that click reads as "clicked an
			// already-selected element again" and opens the inline editor, whose
			// blur then rebuilds textSegments from plain text and drops OOXML
			// round-trip-only fields - and pushes a spurious extra undo entry.
			if (justSelectedRef.current || justInteractedRef.current) {
				justSelectedRef.current = false;
				justInteractedRef.current = false;
			} else {
				const el = elementLookup.get(elementId);
				if (el && hasTextProperties(el) && canInteractWithElement(el, 'textEdit')) {
					// Equations open the equation editor (same as double-click);
					// letting them into inline text editing destroys the OMML.
					if (!openEquationEditorForElement(el)) {
						setInlineEditingElementId(elementId);
						setInlineEditingText(el.text ?? '');
					}
				}
			}
		} else {
			ops.applySelection(elementId);
		}
	};

	const handleElementDoubleClick = (elementId: string, _e: React.MouseEvent) => {
		const el = elementLookup.get(elementId);
		if (!el) {
			return;
		}
		if (openEquationEditorForElement(el)) {
			return;
		}
		if (hasTextProperties(el) && canInteractWithElement(el, 'textEdit')) {
			setInlineEditingElementId(elementId);
			setInlineEditingText(el.text ?? '');
		}
	};

	const handleElementMouseDown = (elementId: string, e: React.MouseEvent) => {
		if (e.button !== 0) {
			return;
		}
		// Pressing another element while inline-editing must commit the pending text
		// first. On touch the editor's blur can fire too late (after pointerup has
		// run), so commit deterministically rather than relying on blur ordering.
		if (inlineEditingElementId && inlineEditingElementId !== elementId) {
			handleInlineEditCommit();
		}
		if (!mouseDownStartsSelectionDrag(e)) {
			return;
		}
		const wasSelected = selectedElementIdSet.has(elementId);
		if (!wasSelected) {
			ops.applySelection(elementId);
			justSelectedRef.current = true;
		} else {
			justSelectedRef.current = false;
		}
		// When this mousedown is what selected the element, `effectiveSelectedIds`
		// still reflects the prior render's selection (applySelection only schedules
		// a state update). Using it here would drag the previously-selected element
		// while focus moves to the new one. Drag just the clicked element instead.
		const ids = !wasSelected
			? [elementId]
			: effectiveSelectedIds.length
				? effectiveSelectedIds
				: [elementId];
		// `a:spLocks/@noMove` pins a shape: it may still be selected (so the
		// inspector can unlock it) but it must not travel with the drag, and a
		// multi-selection drags only its movable members - exactly as PowerPoint
		// does. Arming an empty drag would move nothing and still swallow the
		// trailing click, so bail out entirely when nothing is movable.
		const movableIds = filterInteractableIds(ids, (id) => elementLookup.get(id), 'move');
		if (movableIds.length === 0) {
			return;
		}
		const startPositions: Record<string, { x: number; y: number }> = {};
		const domEls = new Map<string, HTMLElement>();
		for (const id of movableIds) {
			const el = elementLookup.get(id);
			if (el) {
				startPositions[id] = { x: el.x, y: el.y };
			}
			const domEl = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null;
			if (domEl) {
				domEls.set(id, domEl);
			}
		}
		dragStateRef.current = {
			elementId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startPositionsById: startPositions,
			domEls,
			moved: false,
			lastDx: 0,
			lastDy: 0,
		};
		setSnapLines([]);
	};

	const handleElementContextMenu = (elementId: string, e: React.MouseEvent) => {
		if (mode === 'present') {
			// During a slide show, right-clicks belong to the presentation-level
			// menu (ViewerCanvasArea); let the event bubble up unhandled.
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		if (!selectedElementIdSet.has(elementId)) {
			ops.applySelection(elementId);
		}
		setContextMenuState({ x: e.clientX, y: e.clientY, elementId });
	};

	const handleCanvasMouseDown = (e: React.MouseEvent) => {
		if (mode !== 'edit' || !canEdit || e.button !== 0 || activeTool !== 'select') {
			return;
		}
		// Tapping empty canvas starts a marquee; a tap-sized marquee resolves to
		// clearSelection() on pointerup, which drops inline editing without saving.
		// Commit any in-progress edit up front so touch tap-away keeps the text.
		if (inlineEditingElementId) {
			handleInlineEditCommit();
		}
		const stage = canvasStageRef.current;
		if (!stage) {
			return;
		}
		const rect = stage.getBoundingClientRect();
		const scale = editorScale || 1;
		const startX = Math.max(0, Math.min(canvasSize.width, (e.clientX - rect.left) / scale));
		const startY = Math.max(0, Math.min(canvasSize.height, (e.clientY - rect.top) / scale));
		const additive = e.shiftKey || e.metaKey;
		const nextMarquee = {
			startX,
			startY,
			currentX: startX,
			currentY: startY,
			additive,
			baseSelectionIds: additive ? effectiveSelectedIds : [],
		};
		marqueeStateRef.current = nextMarquee;
		setMarqueeSelectionState(nextMarquee);
		setContextMenuState(null);
	};

	const handleResizePointerDown = (elementId: string, e: React.MouseEvent, handle: string) => {
		e.stopPropagation();
		const el = elementLookup.get(elementId);
		if (!el || !canInteractWithElement(el, 'resize')) {
			return;
		}
		resizeStateRef.current = {
			elementId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startX: el.x,
			startY: el.y,
			startWidth: el.width,
			startHeight: el.height,
			handle: handle as 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w',
			moved: false,
			domEl: document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement | null,
			lastX: el.x,
			lastY: el.y,
			lastWidth: el.width,
			lastHeight: el.height,
		};
	};

	const handleRotate = (elementId: string, rotationDeg: number) => {
		const el = elementLookup.get(elementId);
		if (!el || !canInteractWithElement(el, 'rotate')) {
			return;
		}
		ops.updateElementById(elementId, { rotation: rotationDeg } as Partial<PptxElement>);
		history.markDirty();
		// Rotation changes no element counts; bump the pointer-commit nonce so
		// the history hook records it as an undo step.
		setPointerCommitNonce?.((n) => n + 1);
	};

	// Commit an inline (on-canvas) SmartArt or chart edit. Routes through the
	// same element-update path (updateElementById) the inspector uses, then
	// bumps the pointer-commit nonce so the history hook snapshots the edit as
	// its own undo step (content-only edits change no element counts, so they
	// would otherwise be skipped by the history cheap-hash gate).
	const handleUpdateSmartArtElement = (elementId: string, updates: Partial<PptxElement>) => {
		if (!elementLookup.has(elementId)) {
			return;
		}
		ops.updateElementById(elementId, updates);
		setPointerCommitNonce?.((n) => n + 1);
	};

	// Apply an inline-editing text-style toggle (Ctrl/Cmd+B/I/U) to the selected
	// element. Routes through the same updateSelectedTextStyle path as the
	// toolbar, so it hits history/dirty marking and remaps rich segments.
	const handleFormatText = (updates: Partial<TextStyle>) => {
		ops.updateSelectedTextStyle(updates);
	};

	const handleAdjustmentPointerDown = (
		elementId: string,
		e: React.MouseEvent,
		descriptor: ShapeAdjustmentHandleDescriptor,
	) => {
		e.stopPropagation();
		const el = elementLookup.get(elementId);
		if (!el || !canInteractWithElement(el, 'adjustHandle')) {
			return;
		}
		// The gesture starts from the DESCRIPTOR the user actually grabbed, not
		// from the element's first authored adjustment. The old code read
		// `Object.entries(shapeAdjustments)[0]` and bailed when the map was empty,
		// so a preset sitting on its `a:avLst` defaults (the common case for a
		// shape inserted from the picker) had a handle that could not be dragged
		// at all, and a multi-adjust preset always dragged its first guide
		// whichever diamond was grabbed.
		shapeAdjustmentDragStateRef.current = beginShapeAdjustment(
			el,
			descriptor,
			e.clientX,
			e.clientY,
		);
	};

	return {
		handleElementClick,
		handleElementDoubleClick,
		handleElementMouseDown,
		handleElementContextMenu,
		handleCanvasMouseDown,
		handleResizePointerDown,
		handleAdjustmentPointerDown,
		handleRotate,
		handleUpdateSmartArtElement,
		handleFormatText,
		handleInlineEditCommit,
	};
}
