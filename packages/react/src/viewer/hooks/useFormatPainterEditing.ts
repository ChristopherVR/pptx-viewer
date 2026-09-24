import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
/**
 * useFormatPainterEditing: the format painter's copy/apply state machine,
 * split out of useEditorOperations to keep that composer under this repo's
 * file-size limit.
 *
 * Supports two trigger paths that share the same captured format: the
 * ribbon's click-a-source-then-click-a-target toggle, and the
 * Ctrl/Cmd+Shift+C / Ctrl/Cmd+Shift+V keyboard shortcuts, which copy from and
 * apply to whatever is already selected without an intervening click.
 */
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { CopiedFormat } from '../utils/format-painter';
import { applyFormatToElement, copyFormatFromElement } from '../utils/format-painter';
import type { CanvasInteractionHandlers } from './useCanvasInteractions';
import type { ElementOperations } from './useElementOperations';

export interface UseFormatPainterEditingInput {
	selectedElement: PptxElement | null;
	elementLookup: Map<string, PptxElement>;
	formatPainterActive: boolean;
	setFormatPainterActive: (active: boolean) => void;
	canvasHandlers: CanvasInteractionHandlers;
	ops: ElementOperations;
}

export interface UseFormatPainterEditingResult {
	canvasHandlers: CanvasInteractionHandlers;
	/**
	 * Ctrl/Cmd+Shift+C: copy the selected element's format, the same capture
	 * the format-painter ribbon toggle triggers, without requiring a
	 * follow-up click to apply it.
	 */
	copyFormatFromSelection: () => void;
	/**
	 * Ctrl/Cmd+Shift+V: apply whatever format was copied onto every given
	 * element id, then clear it the same way the click-to-apply path does.
	 */
	pasteFormatToSelection: (targetIds: string[]) => void;
}

/** The patch to persist for one element receiving a copied format. */
function formatPatchFor(element: PptxElement, format: CopiedFormat): Partial<PptxElement> {
	const updated = applyFormatToElement(element, format);
	const updates: Partial<PptxElement> = {};
	if (hasShapeProperties(updated)) {
		(updates as { shapeStyle?: unknown }).shapeStyle = updated.shapeStyle;
	}
	if (hasTextProperties(updated)) {
		(updates as { textStyle?: unknown }).textStyle = updated.textStyle;
	}
	return updates;
}

export function useFormatPainterEditing(
	input: UseFormatPainterEditingInput,
): UseFormatPainterEditingResult {
	const {
		selectedElement,
		elementLookup,
		formatPainterActive,
		setFormatPainterActive,
		canvasHandlers,
		ops,
	} = input;

	// Capture formatting from the selected element when the painter is
	// activated. The ribbon toggle and `copyFormatFromSelection` both just set
	// `formatPainterActive`; this effect performs the actual capture.
	const copiedFormatRef = useRef<CopiedFormat | null>(null);
	const prevFormatPainterRef = useRef(false);

	useEffect(() => {
		if (formatPainterActive && !prevFormatPainterRef.current && selectedElement) {
			copiedFormatRef.current = copyFormatFromElement(selectedElement);
		} else if (!formatPainterActive) {
			copiedFormatRef.current = null;
		}
		prevFormatPainterRef.current = formatPainterActive;
	}, [formatPainterActive, selectedElement]);

	const copyFormatFromSelection = useCallback(() => {
		if (selectedElement) {
			setFormatPainterActive(true);
		}
	}, [selectedElement, setFormatPainterActive]);

	const pasteFormatToSelection = useCallback(
		(targetIds: string[]) => {
			const format = copiedFormatRef.current;
			if (!format) {
				return;
			}
			for (const id of targetIds) {
				const element = elementLookup.get(id);
				if (element) {
					ops.updateElementById(id, formatPatchFor(element, format));
				}
			}
			copiedFormatRef.current = null;
			setFormatPainterActive(false);
		},
		[elementLookup, ops, setFormatPainterActive],
	);

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
	//  - apply the copied format on element click when the painter is active;
	//  - cancel the painter when the user mousedowns on empty canvas.
	const wrappedCanvasHandlers: CanvasInteractionHandlers = useMemo(
		() => ({
			...canvasHandlers,
			handleElementClick: (elementId: string, e: React.MouseEvent) => {
				if (formatPainterActive && copiedFormatRef.current) {
					e.stopPropagation();
					const element = elementLookup.get(elementId);
					if (element) {
						ops.updateElementById(elementId, formatPatchFor(element, copiedFormatRef.current));
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
		canvasHandlers: wrappedCanvasHandlers,
		copyFormatFromSelection,
		pasteFormatToSelection,
	};
}
