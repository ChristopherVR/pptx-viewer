import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, ShapeStyle, TextStyle } from 'pptx-viewer-core';
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
	history: EditorHistoryResult;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	setTemplateElementsBySlideId: React.Dispatch<React.SetStateAction<Record<string, PptxElement[]>>>;
	setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
	setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
	setInlineEditingElementId: React.Dispatch<React.SetStateAction<string | null>>;
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
		history,
		setSlides,
		setTemplateElementsBySlideId,
		setSelectedElementId,
		setSelectedElementIds,
		setInlineEditingElementId,
		setContextMenuState,
	} = input;

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
	const updateElementById = useCallback(
		(elementId: string, updates: Partial<PptxElement>) => {
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
				setSlides((prev) =>
					prev.map((s, i) =>
						i !== activeSlideIndex
							? s
							: {
									...s,
									elements: s.elements.map((el) =>
										el.id === elementId
											? ({
													...el,
													...updates,
												} as PptxElement)
											: el,
									),
								},
					),
				);
			}
			history.markDirty();
		},
		[activeSlide?.id, activeSlideIndex, history, setSlides, setTemplateElementsBySlideId],
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

			// Check if there's an active text selection in the inline editor
			const inlineSel = getInlineEditorSelection(selectedElement.textSegments);
			if (inlineSel && selectedElement.textSegments) {
				// Apply formatting only to the selected segment range
				const { newSegments, newSelection } = applyStyleToSelectedSegments(
					selectedElement.textSegments,
					inlineSel,
					updates,
				);
				// Store restore info so InlineTextEditor can restore the cursor
				setPendingSelectionRestore(newSelection);
				updateSelectedElement({
					textSegments: newSegments,
				} as Partial<PptxElement>);
				return;
			}

			// No inline selection: apply to the entire element (existing behavior)
			const newTextStyle = { ...selectedElement.textStyle, ...updates };
			const newSegments = selectedElement.textSegments?.map((seg: { style: TextStyle }) => ({
				...seg,
				style: { ...seg.style, ...updates },
			}));
			updateSelectedElement({
				textStyle: newTextStyle,
				textSegments: newSegments,
			} as Partial<PptxElement>);
		},
		[selectedElement, updateSelectedElement],
	);

	const updateSelectedTextCase = useCallback(
		(mode: ChangeCaseMode) => {
			if (!selectedElement || !hasTextProperties(selectedElement)) {
				return;
			}

			const inlineSel = getInlineEditorSelection(selectedElement.textSegments);
			if (inlineSel && selectedElement.textSegments) {
				const newSegments = applyCaseTransformToSegments(
					selectedElement.textSegments,
					inlineSel,
					mode,
				);
				updateSelectedElement({ textSegments: newSegments } as Partial<PptxElement>);
				return;
			}

			// No inline selection: transform the entire element's text.
			const updates: Partial<PptxElement> = {};
			if (selectedElement.textSegments && selectedElement.textSegments.length > 0) {
				(updates as { textSegments?: unknown }).textSegments = applyCaseTransformToSegments(
					selectedElement.textSegments,
					null,
					mode,
				);
			}
			if (typeof selectedElement.text === 'string') {
				(updates as { text?: string }).text = transformTextCase(selectedElement.text, mode);
			}
			updateSelectedElement(updates);
		},
		[selectedElement, updateSelectedElement],
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
	const activeElements = editTemplateMode ? templateElements : (activeSlide?.elements ?? []);

	const updateActiveElements = useCallback(
		(updater: (els: PptxElement[]) => PptxElement[]) => {
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
		[editTemplateMode, activeSlide?.id, activeSlideIndex, setSlides, setTemplateElementsBySlideId],
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
