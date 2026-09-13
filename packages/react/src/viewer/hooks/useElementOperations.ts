import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, ShapeStyle } from 'pptx-viewer-core';
import {
	masterViewElements as resolveMasterViewElements,
	replaceMasterViewElements,
	updateElement as updateSlideElement,
	updateMasterViewElement,
} from 'pptx-viewer-shared';
import type { MasterViewWrite } from 'pptx-viewer-shared';
/**
 * useElementOperations: Element update callbacks for PowerPointViewer.
 *
 * Provides selection helpers and element mutation functions that act on
 * the current slide / template layer.
 */
import { useCallback } from 'react';

import { isTemplateElementId } from '../utils';
import type { ElementOperations, UseElementOperationsInput } from './element-operations-types';
import { useTextElementOperations } from './useTextElementOperations';

export type {
	ElementOperations,
	UseElementOperationsInput,
	MasterViewRouting,
} from './element-operations-types';

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
		inlineEditingSnapshotRef,
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

	const { updateSelectedTextStyle, updateSelectedTextCase } = useTextElementOperations({
		selectedElement,
		inlineEditingElementId,
		inlineEditingText,
		inlineEditingSnapshotRef,
		setInlineEditingElementId,
		updateSelectedElement,
	});

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
