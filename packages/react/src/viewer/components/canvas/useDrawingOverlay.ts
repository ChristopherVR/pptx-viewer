import type { InkPptxElement, PptxSlide, ShapePptxElement } from 'pptx-viewer-core';
import type { InkStrokeView } from 'pptx-viewer-shared';
import { findEraserHitElementId } from 'pptx-viewer-shared';
import React, { useCallback, useState } from 'react';

import type { DrawingTool } from '../../types-ui';
import type { ZoomViewport } from './canvas-types';
import { finishDrawStroke } from './finishDrawStroke';
import { useLiveInkPreview } from './useLiveInkPreview';

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface DrawingOverlayState {
	isDrawing: boolean;
	isStrokeActive: boolean;
	liveStrokeD: string;
	/**
	 * The in-progress stroke's render view (plain path, pressure circles, or
	 * tilt nib marks), built by the shared `buildLiveInkStrokeView` from the
	 * SAME accumulated per-point pressure/tilt data a committed stroke uses.
	 * `null` while idle. `DrawingOverlaySvg` renders this instead of
	 * `liveStrokeD` so a calligraphic lean or pressure-variable width appears
	 * DURING the gesture, not only after `pointerup`.
	 */
	liveStrokeView: InkStrokeView | null;
	currentStrokePoints: Array<{ x: number; y: number }>;
	handleDrawPointerDown: (e: React.PointerEvent) => void;
	handleDrawPointerMove: (e: React.PointerEvent) => void;
	handleDrawPointerUp: (e: React.PointerEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDrawingOverlay({
	activeTool,
	activeSlide,
	zoom,
	drawingColor,
	drawingWidth,
	isDrawingRef,
	onAddInkElement,
	onAddFreeformShape,
	onEraseInkElement,
}: {
	activeTool: DrawingTool;
	activeSlide: PptxSlide | undefined;
	zoom: ZoomViewport;
	drawingColor: string;
	drawingWidth: number;
	isDrawingRef?: React.RefObject<boolean>;
	onAddInkElement?: (ink: InkPptxElement) => void;
	onAddFreeformShape?: (shape: ShapePptxElement) => void;
	onEraseInkElement?: (elementId: string) => void;
}): DrawingOverlayState {
	const isDrawing = activeTool !== 'select';
	const [currentStrokePoints, setCurrentStrokePoints] = useState<Array<{ x: number; y: number }>>(
		[],
	);
	const [currentStrokePressures, setCurrentStrokePressures] = useState<number[]>([]);
	const [currentStrokeTiltX, setCurrentStrokeTiltX] = useState<number[]>([]);
	const [currentStrokeTiltY, setCurrentStrokeTiltY] = useState<number[]>([]);
	const [isStrokeActive, setIsStrokeActive] = useState(false);

	/** Convert pointer position to canvas-local coordinates. */
	const pointerToCanvasCoords = useCallback(
		(e: React.PointerEvent): { x: number; y: number } | null => {
			const stage = zoom.canvasStageRef.current;
			if (!stage) {
				return null;
			}
			const rect = stage.getBoundingClientRect();
			const scale = zoom.editorScale || 1;
			return {
				x: (e.clientX - rect.left) / scale,
				y: (e.clientY - rect.top) / scale,
			};
		},
		[zoom.canvasStageRef, zoom.editorScale],
	);

	const handleDrawPointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (activeTool === 'select') {
				return;
			}
			// Eraser: find and remove the top-most ink/contentPart element near
			// the click point. `contentPart` is included because ink saved via
			// the Draw tab reloads in that shape (a passed-through InkML part),
			// so it must stay erasable after a save/reload round-trip.
			if (activeTool === 'eraser' && activeSlide) {
				const pt = pointerToCanvasCoords(e);
				if (!pt) {
					return;
				}
				const hitId = findEraserHitElementId(activeSlide.elements, pt);
				if (hitId) {
					onEraseInkElement?.(hitId);
				}
				return;
			}
			// Pen / Highlighter: start stroke
			const pt = pointerToCanvasCoords(e);
			if (!pt) {
				return;
			}
			e.preventDefault();
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
			setCurrentStrokePoints([pt]);
			setCurrentStrokePressures([e.pressure]);
			setCurrentStrokeTiltX([e.tiltX ?? 0]);
			setCurrentStrokeTiltY([e.tiltY ?? 0]);
			setIsStrokeActive(true);
			if (isDrawingRef) {
				(isDrawingRef as React.MutableRefObject<boolean>).current = true;
			}
		},
		[activeTool, activeSlide, pointerToCanvasCoords, isDrawingRef, onEraseInkElement],
	);

	const handleDrawPointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isStrokeActive || activeTool === 'select' || activeTool === 'eraser') {
				return;
			}
			const pt = pointerToCanvasCoords(e);
			if (!pt) {
				return;
			}
			setCurrentStrokePoints((prev) => [...prev, pt]);
			setCurrentStrokePressures((prev) => [...prev, e.pressure]);
			setCurrentStrokeTiltX((prev) => [...prev, e.tiltX ?? 0]);
			setCurrentStrokeTiltY((prev) => [...prev, e.tiltY ?? 0]);
		},
		[isStrokeActive, activeTool, pointerToCanvasCoords],
	);

	const handleDrawPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!isStrokeActive || activeTool === 'select' || activeTool === 'eraser') {
				return;
			}
			(e.target as HTMLElement).releasePointerCapture(e.pointerId);
			setIsStrokeActive(false);
			if (isDrawingRef) {
				(isDrawingRef as React.MutableRefObject<boolean>).current = false;
			}
			// Turns the accumulated points into a committed `ink` element or
			// `freeform` shape (or `null` for a too-short stroke, a plain tap);
			// see `finishDrawStroke` for the pure geometry/element construction.
			const finished = finishDrawStroke({
				tool: activeTool,
				points: currentStrokePoints,
				pressures: currentStrokePressures,
				tiltX: currentStrokeTiltX,
				tiltY: currentStrokeTiltY,
				color: drawingColor,
				width: drawingWidth,
			});
			if (finished?.kind === 'freeform') {
				onAddFreeformShape?.(finished.element);
			} else if (finished?.kind === 'ink') {
				onAddInkElement?.(finished.element);
			}
			setCurrentStrokePoints([]);
			setCurrentStrokePressures([]);
			setCurrentStrokeTiltX([]);
			setCurrentStrokeTiltY([]);
		},
		[
			isStrokeActive,
			activeTool,
			currentStrokePoints,
			currentStrokeTiltX,
			currentStrokeTiltY,
			drawingColor,
			drawingWidth,
			isDrawingRef,
			onAddInkElement,
			onAddFreeformShape,
			currentStrokePressures,
		],
	);

	// The live preview (plain path + shared render-view decision) is its own
	// hook: see `useLiveInkPreview` for why this was split out.
	const { liveStrokeD, liveStrokeView } = useLiveInkPreview(
		isStrokeActive,
		activeTool,
		currentStrokePoints,
		currentStrokePressures,
		currentStrokeTiltX,
		currentStrokeTiltY,
		drawingColor,
		drawingWidth,
	);

	return {
		isDrawing,
		isStrokeActive,
		liveStrokeD,
		liveStrokeView,
		currentStrokePoints,
		handleDrawPointerDown,
		handleDrawPointerMove,
		handleDrawPointerUp,
	};
}
