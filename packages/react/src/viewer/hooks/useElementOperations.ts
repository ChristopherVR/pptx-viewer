import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
	ShapeStyle,
	TextSegment,
	TextStyle,
} from 'pptx-viewer-core';
import {
	masterViewElements as resolveMasterViewElements,
	remapTextToSegments,
	replaceMasterViewElements,
	updateElement as updateSlideElement,
	updateMasterViewElement,
} from 'pptx-viewer-shared';
import type { MasterViewTarget, MasterViewWrite } from 'pptx-viewer-shared';
/**
 * useElementOperations: Element update callbacks for PowerPointViewer.
 *
 * Provides selection helpers and element mutation functions that act on
 * the current slide / template layer.
 */
import { useCallback } from 'react';

import { isTemplateElementId } from '../utils';
import {
	getInlineEditorSelection,
	applyStyleToSelectedSegments,
	setPendingSelectionRestore,
} from '../utils/inline-selection-utils';
import { applyCaseTransformToSegments, transformTextCase } from '../utils/text-case-transform';
import type { ChangeCaseMode } from '../utils/text-case-transform';
import type { EditorHistoryResult } from './useEditorHistory';

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

/**
 * View > Slide Master routing.
 *
 * The master view paints a part that is not in `slides`, so an edit made
 * there has to be written back into the master / layout / notes / handout
 * model instead. React previously keyed a pseudo-slide on the master's
 * archive path and pushed edits into `templateElementsBySlideId`, where
 * `buildSaveSlides` looks parts up by real slide id and so never found them:
 * the change showed on screen and vanished on save.
 */
export interface MasterViewRouting {
	target: MasterViewTarget | null;
	slideMasters: PptxSlideMaster[];
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
	setNotesMaster: React.Dispatch<React.SetStateAction<PptxNotesMaster | undefined>>;
	setHandoutMaster: React.Dispatch<React.SetStateAction<PptxHandoutMaster | undefined>>;
}

export interface UseElementOperationsInput {
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	selectedElementId: string | null;
	/** When true, element operations target the template store, not slide.elements. */
	editTemplateMode: boolean;
	/** Template (master/layout) elements for the active slide. */
	templateElements: PptxElement[];
	/** Set while View > Slide Master is open; routes writes to the master part. */
	masterView?: MasterViewRouting | undefined;
	history: EditorHistoryResult;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	setTemplateElementsBySlideId: React.Dispatch<React.SetStateAction<Record<string, PptxElement[]>>>;
	setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
	setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
	setInlineEditingElementId: React.Dispatch<React.SetStateAction<string | null>>;
	/**
	 * The element currently being inline-edited, and its live (uncommitted)
	 * plain text. `InlineTextEditor`'s contentEditable is UNCONTROLLED — the
	 * DOM owns the text between keystrokes and blur, only pushing plain text
	 * out on every input — so `selectedElement.textSegments` on the model can
	 * be stale relative to what's on screen while the user is still typing.
	 * A toolbar style click (Bold, etc.) doesn't blur first (see the toolbar
	 * buttons' `onMouseDown` + `preventDefault`), so it can land while that gap
	 * exists. `updateSelectedTextStyle`/`updateSelectedTextCase` reconcile
	 * against these before touching segments, so a style change always applies
	 * to what the user actually sees, not stale pre-keystroke content.
	 */
	inlineEditingElementId: string | null;
	inlineEditingText: string;
	setContextMenuState: React.Dispatch<
		React.SetStateAction<import('../types').ElementContextMenuState | null>
	>;
}

export interface ElementOperations {
	applySelection: (primaryId: string | null, ids?: string[]) => void;
	clearSelection: () => void;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
	updateSelectedElement: (updates: Partial<PptxElement>) => void;
	updateSelectedShapeStyle: (updates: Partial<ShapeStyle>) => void;
	updateSelectedTextStyle: (updates: Partial<TextStyle>) => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	updateSelectedTextCase: (mode: ChangeCaseMode) => void;
	updateSlides: (updater: (s: PptxSlide[]) => PptxSlide[]) => void;
	/**
	 * The element list currently being edited: the template store for the active
	 * slide while edit-template mode is on, otherwise the active slide's elements.
	 */
	activeElements: PptxElement[];
	/**
	 * Replace the active element list (template store or slide.elements depending
	 * on edit-template mode). Does not mark the document dirty; callers do.
	 */
	updateActiveElements: (updater: (els: PptxElement[]) => PptxElement[]) => void;
	serializeSlides: () => Promise<Uint8Array | null>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useElementOperations(input: UseElementOperationsInput): ElementOperations {
	const {
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		editTemplateMode,
		templateElements,
		masterView,
		history,
		setSlides,
		setTemplateElementsBySlideId,
		setSelectedElementId,
		setSelectedElementIds,
		setInlineEditingElementId,
		setContextMenuState,
		inlineEditingElementId,
		inlineEditingText,
	} = input;

	/**
	 * `selectedElement.textSegments`, reconciled with the live DOM text when
	 * `selectedElement` is the one currently being inline-edited. Uses the
	 * SAME remap the blur/commit path uses (`remapTextToSegments`), so a
	 * mid-edit toolbar style click computes its selection range and writes
	 * its update against what is actually on screen, not a stale pre-keystroke
	 * snapshot. See `inlineEditingElementId`/`inlineEditingText` above.
	 */
	const liveTextSegments = useCallback((): TextSegment[] | undefined => {
		if (!selectedElement || !hasTextProperties(selectedElement)) {
			return undefined;
		}
		if (selectedElement.id !== inlineEditingElementId) {
			return selectedElement.textSegments;
		}
		return remapTextToSegments(
			inlineEditingText,
			selectedElement.textSegments,
			selectedElement.textStyle,
		);
	}, [selectedElement, inlineEditingElementId, inlineEditingText]);

	// ── Selection ─────────────────────────────────────────────────────
	const applySelection = useCallback(
		(primaryId: string | null, ids: string[] = []) => {
			setSelectedElementId(primaryId);
			setSelectedElementIds(ids);
		},
		[setSelectedElementId, setSelectedElementIds],
	);

	const clearSelection = useCallback(() => {
		applySelection(null, []);
		setInlineEditingElementId(null);
		setContextMenuState(null);
	}, [applySelection, setInlineEditingElementId, setContextMenuState]);

	// ── Element Updates ───────────────────────────────────────────────
	// Template (master/layout) elements live in their own per-slide store (the
	// separate-state architecture), so edits route by id prefix: a `layout-` /
	// `master-` id updates the template store; any other id updates the active
	// slide's elements. Template edits are merged back into the saved deck by
	// buildSaveSlides so they persist to the shared master/layout part.
	// Apply a shared master-view write descriptor to the React state it names.
	const applyMasterViewWrite = useCallback(
		(write: MasterViewWrite | null): boolean => {
			if (!write || !masterView) {
				return false;
			}
			if (write.slideMasters) {
				masterView.setSlideMasters(write.slideMasters);
			}
			if (write.notesMaster) {
				masterView.setNotesMaster(write.notesMaster);
			}
			if (write.handoutMaster) {
				masterView.setHandoutMaster(write.handoutMaster);
			}
			history.markDirty();
			return true;
		},
		[history, masterView],
	);

	const updateElementById = useCallback(
		(elementId: string, updates: Partial<PptxElement>) => {
			if (masterView?.target) {
				applyMasterViewWrite(
					updateMasterViewElement(masterView, masterView.target, elementId, updates),
				);
				return;
			}
			if (isTemplateElementId(elementId)) {
				const slideId = activeSlide?.id;
				if (slideId) {
					setTemplateElementsBySlideId((prev) => ({
						...prev,
						[slideId]: (prev[slideId] ?? []).map((el) =>
							el.id === elementId ? ({ ...el, ...updates } as PptxElement) : el,
						),
					}));
				}
			} else {
				setSlides((prev) => updateSlideElement(prev, activeSlideIndex, elementId, updates));
			}
			history.markDirty();
		},
		[
			activeSlide?.id,
			activeSlideIndex,
			applyMasterViewWrite,
			history,
			masterView,
			setSlides,
			setTemplateElementsBySlideId,
		],
	);

	const updateSelectedElement = useCallback(
		(updates: Partial<PptxElement>) => {
			if (!selectedElementId) {
				return;
			}
			updateElementById(selectedElementId, updates);
		},
		[selectedElementId, updateElementById],
	);

	const updateSelectedShapeStyle = useCallback(
		(updates: Partial<ShapeStyle>) => {
			if (!selectedElement || !hasShapeProperties(selectedElement)) {
				return;
			}
			updateSelectedElement({
				shapeStyle: { ...selectedElement.shapeStyle, ...updates },
			} as Partial<PptxElement>);
		},
		[selectedElement, updateSelectedElement],
	);

	const updateSelectedTextStyle = useCallback(
		(updates: Partial<TextStyle>) => {
			if (!selectedElement || !hasTextProperties(selectedElement)) {
				return;
			}

			const isLiveEditing = selectedElement.id === inlineEditingElementId;
			const currentSegments = liveTextSegments();

			// Check if there's an active text selection in the inline editor
			const inlineSel = getInlineEditorSelection(currentSegments);
			if (inlineSel && currentSegments) {
				// Apply formatting only to the selected segment range
				const { newSegments, newSelection } = applyStyleToSelectedSegments(
					currentSegments,
					inlineSel,
					updates,
				);
				// Store restore info so InlineTextEditor can restore the cursor
				setPendingSelectionRestore(newSelection);
				updateSelectedElement({
					textSegments: newSegments,
					...(isLiveEditing ? { text: inlineEditingText } : {}),
				} as Partial<PptxElement>);
				return;
			}

			// No inline selection: apply to the entire element (existing behavior)
			const newTextStyle = { ...selectedElement.textStyle, ...updates };
			const newSegments = currentSegments?.map((seg: { style: TextStyle }) => ({
				...seg,
				style: { ...seg.style, ...updates },
			}));
			updateSelectedElement({
				textStyle: newTextStyle,
				textSegments: newSegments,
				...(isLiveEditing ? { text: inlineEditingText } : {}),
			} as Partial<PptxElement>);
		},
		[
			selectedElement,
			updateSelectedElement,
			inlineEditingElementId,
			inlineEditingText,
			liveTextSegments,
		],
	);

	const updateSelectedTextCase = useCallback(
		(mode: ChangeCaseMode) => {
			if (!selectedElement || !hasTextProperties(selectedElement)) {
				return;
			}

			const isLiveEditing = selectedElement.id === inlineEditingElementId;
			const currentSegments = liveTextSegments();

			const inlineSel = getInlineEditorSelection(currentSegments);
			if (inlineSel && currentSegments) {
				const newSegments = applyCaseTransformToSegments(currentSegments, inlineSel, mode);
				updateSelectedElement({
					textSegments: newSegments,
					...(isLiveEditing ? { text: inlineEditingText } : {}),
				} as Partial<PptxElement>);
				return;
			}

			// No inline selection: transform the entire element's text.
			const updates: Partial<PptxElement> = {};
			if (currentSegments && currentSegments.length > 0) {
				(updates as { textSegments?: unknown }).textSegments = applyCaseTransformToSegments(
					currentSegments,
					null,
					mode,
				);
			}
			const baseText = isLiveEditing ? inlineEditingText : selectedElement.text;
			if (typeof baseText === 'string') {
				(updates as { text?: string }).text = transformTextCase(baseText, mode);
			}
			updateSelectedElement(updates);
		},
		[
			selectedElement,
			updateSelectedElement,
			inlineEditingElementId,
			inlineEditingText,
			liveTextSegments,
		],
	);

	// ── Slide-level helpers ───────────────────────────────────────────
	const updateSlides = useCallback(
		(updater: (s: PptxSlide[]) => PptxSlide[]) => {
			setSlides((prev) => updater(prev));
		},
		[setSlides],
	);

	// ── Active-store helpers ──────────────────────────────────────────
	// Element-list operations (group, ungroup, layer-order, paste, delete) act on
	// whichever store is being edited: the template store while edit-template mode
	// is on, otherwise the active slide's elements.
	// In master view the active store is the master/layout part itself, which is
	// neither `slides` nor the per-slide template store.
	const masterViewTarget = masterView?.target ?? null;
	const activeElements = masterViewTarget
		? resolveMasterViewElements(masterView!, masterViewTarget)
		: editTemplateMode
			? templateElements
			: (activeSlide?.elements ?? []);

	const updateActiveElements = useCallback(
		(updater: (els: PptxElement[]) => PptxElement[]) => {
			if (masterView?.target) {
				applyMasterViewWrite(
					replaceMasterViewElements(
						masterView,
						masterView.target,
						updater(resolveMasterViewElements(masterView, masterView.target)),
					),
				);
				return;
			}
			if (editTemplateMode) {
				const slideId = activeSlide?.id;
				if (!slideId) {
					return;
				}
				setTemplateElementsBySlideId((prev) => ({
					...prev,
					[slideId]: updater(prev[slideId] ?? []),
				}));
			} else {
				setSlides((prev) =>
					prev.map((s, i) =>
						i === activeSlideIndex ? { ...s, elements: updater(s.elements) } : s,
					),
				);
			}
		},
		[
			applyMasterViewWrite,
			editTemplateMode,
			masterView,
			activeSlide?.id,
			activeSlideIndex,
			setSlides,
			setTemplateElementsBySlideId,
		],
	);

	// Note: serializeSlides is intentionally kept in the main component
	// because it depends on handlerRef and headerFooter. We return a
	// placeholder here that the main component can override or skip.
	const serializeSlides = useCallback(async (): Promise<Uint8Array | null> => {
		// Actual serialisation is handled in PowerPointViewer.tsx via
		// handlerRef.current.save(): this hook does not own the handler.
		return null;
	}, []);

	return {
		applySelection,
		clearSelection,
		updateElementById,
		updateSelectedElement,
		updateSelectedShapeStyle,
		updateSelectedTextStyle,
		updateSelectedTextCase,
		updateSlides,
		activeElements,
		updateActiveElements,
		serializeSlides,
	};
}
