import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, ShapeStyle, TextStyle } from 'pptx-viewer-core';
/**
 * useElementOperations: Element update callbacks for PowerPointViewer.
 *
 * Provides selection helpers and element mutation functions that act on
 * the current slide / template layer.
 */
import { useCallback } from 'react';

import {
	getInlineEditorSelection,
	applyStyleToSelectedSegments,
	setPendingSelectionRestore,
} from '../utils/inline-selection-utils';
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
	history: EditorHistoryResult;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
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
	updateSlides: (updater: (s: PptxSlide[]) => PptxSlide[]) => void;
	serializeSlides: () => Promise<Uint8Array | null>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useElementOperations(input: UseElementOperationsInput): ElementOperations {
	const {
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		history,
		setSlides,
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
	// Template (master/layout) elements are merged into `slide.elements` by the
	// core loader, so every element - template or not - updates through the same
	// `slides[].elements` path. Edits to a `layout-`/`master-` element therefore
	// persist back to the shared master/layout part via the core save writer.
	const updateElementById = useCallback(
		(elementId: string, updates: Partial<PptxElement>) => {
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
			history.markDirty();
		},
		[activeSlideIndex, history, setSlides],
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

	// ── Slide-level helpers ───────────────────────────────────────────
	const updateSlides = useCallback(
		(updater: (s: PptxSlide[]) => PptxSlide[]) => {
			setSlides((prev) => updater(prev));
		},
		[setSlides],
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
		updateSlides,
		serializeSlides,
	};
}
