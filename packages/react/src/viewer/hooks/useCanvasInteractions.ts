import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
/** useCanvasInteractions: Canvas interaction handlers for the PowerPoint editor. */
import { useRef } from 'react';

import type {
	CanvasSize,
	DragState,
	MarqueeSelectionState,
	ResizeState,
	ShapeAdjustmentDragState,
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
			ops.updateElementById(editId, {
				text: committedText,
				textSegments: newSegments,
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
			if (justSelectedRef.current) {
				justSelectedRef.current = false;
			} else {
				const el = elementLookup.get(elementId);
				if (el && hasTextProperties(el) && !el.locks?.noTextEdit) {
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
		if (hasTextProperties(el)) {
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
		const startPositions: Record<string, { x: number; y: number }> = {};
		const domEls = new Map<string, HTMLElement>();
		for (const id of ids) {
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
		if (!el) {
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
		if (!el || el.locks?.noRotation) {
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

	const handleAdjustmentPointerDown = (elementId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const el = elementLookup.get(elementId);
		if (!el || !('shapeType' in el) || !('shapeAdjustments' in el)) {
			return;
		}
		const adjEntries = Object.entries(
			(el as { shapeAdjustments?: Record<string, number> }).shapeAdjustments ?? {},
		);
		if (!adjEntries.length) {
			return;
		}
		const [key, value] = adjEntries[0];
		shapeAdjustmentDragStateRef.current = {
			elementId,
			key,
			shapeType: (el as { shapeType?: string }).shapeType ?? 'rect',
			startClientX: e.clientX,
			startClientY: e.clientY,
			startAdjustment: value,
			startWidth: el.width,
			startHeight: el.height,
			moved: false,
		};
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
