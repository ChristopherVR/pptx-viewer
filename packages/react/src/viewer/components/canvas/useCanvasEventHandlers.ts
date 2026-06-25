import type { PptxElement } from 'pptx-viewer-core';
/**
 * useCanvasEventHandlers: Event delegation, guide-drag state, find-result
 * highlights, and selected-element bounds for the slide canvas.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';

import type { ElementFindHighlights } from '../../utils/text-segment-helpers';
import { getElementIdFromEvent } from './canvas-types';
import type { ZoomViewport } from './canvas-types';

/** Max delay (ms) between two taps to count as a double-tap on touch. */
const DOUBLE_TAP_MS = 300;

/**
 * True only when the mouse-down landed directly on the scrollable viewport
 * background (the event target is the bound element itself, not a bubbled child
 * such as the slide stage, rulers, handles, or any nested content). Used to
 * treat empty-workspace clicks around a centered slide as a selection-clearing
 * click, mirroring empty slide-stage clicks.
 */
export function isViewportBackgroundMouseDownTarget(
	target: EventTarget | null,
	currentTarget: EventTarget | null,
): boolean {
	return target === currentTarget;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FindResult {
	slideIndex: number;
	elementId: string;
	segmentIndex: number;
	startOffset: number;
	length: number;
}

export interface DraggingGuide {
	id: string;
	axis: 'h' | 'v';
	pointerId: number;
}

export interface CanvasEventHandlers {
	/* find highlights */
	elementFindHighlightsMap: Map<string, ElementFindHighlights>;
	/* selected bounds for ruler highlight */
	selectedBounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
	/* event delegation on the stage */
	handleStageClick: (e: React.MouseEvent) => void;
	handleStageDblClick: (e: React.MouseEvent) => void;
	handleStageMouseDown: (e: React.MouseEvent) => void;
	/**
	 * Press on the scrollable viewport background (empty workspace around the
	 * slide). Clears selection only for direct viewport-background clicks.
	 */
	handleViewportMouseDown: (e: React.MouseEvent) => void;
	/** Touch/pen press on the stage; mirrors handleStageMouseDown for coarse pointers. */
	handleStagePointerDown: (e: React.PointerEvent) => void;
	handleStageContextMenu: (e: React.MouseEvent) => void;
	/* guide dragging */
	draggingGuide: DraggingGuide | null;
	setDraggingGuide: React.Dispatch<React.SetStateAction<DraggingGuide | null>>;
	handleStagePointerMove: (e: React.PointerEvent) => void;
	handleStagePointerUp: (e: React.PointerEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useCanvasEventHandlers({
	cbRef,
	onCanvasMouseDown,
	findResults,
	findResultIndex,
	activeSlideIndex,
	selectedElement,
	zoom,
	onMoveGuide,
}: {
	cbRef: {
		readonly current: {
			onClick: (elementId: string, e: React.MouseEvent) => void;
			onDoubleClick: (elementId: string, e: React.MouseEvent) => void;
			onMouseDown: (elementId: string, e: React.MouseEvent) => void;
			onContextMenu: (elementId: string, e: React.MouseEvent) => void;
		};
	};
	onCanvasMouseDown?: (e: React.MouseEvent) => void;
	findResults?: FindResult[];
	findResultIndex?: number;
	activeSlideIndex?: number;
	selectedElement: PptxElement | null;
	zoom: ZoomViewport;
	onMoveGuide?: (guideId: string, position: number) => void;
}): CanvasEventHandlers {
	/* ── Per-element find highlights (memoised) ───────────────────── */
	const elementFindHighlightsMap = useMemo(() => {
		const map = new Map<string, ElementFindHighlights>();
		if (!findResults || findResults.length === 0 || activeSlideIndex === null) {
			return map;
		}
		for (let i = 0; i < findResults.length; i++) {
			const r = findResults[i];
			if (r.slideIndex !== activeSlideIndex) {
				continue;
			}
			if (!map.has(r.elementId)) {
				map.set(r.elementId, new Map());
			}
			const elMap = map.get(r.elementId)!;
			if (!elMap.has(r.segmentIndex)) {
				elMap.set(r.segmentIndex, []);
			}
			elMap.get(r.segmentIndex)!.push({
				startOffset: r.startOffset,
				length: r.length,
				isCurrent: i === (findResultIndex ?? -1),
			});
		}
		return map;
	}, [findResults, findResultIndex, activeSlideIndex]);

	/* ── Selected element bounds for ruler ────────────────────────── */
	const selectedBounds = useMemo(() => {
		if (!selectedElement) {
			return null;
		}
		return {
			x: selectedElement.x,
			y: selectedElement.y,
			width: selectedElement.width,
			height: selectedElement.height,
		};
	}, [selectedElement]);

	/* ── Event delegation handlers (stable) ──────────────────────── */
	const handleStageClick = useCallback(
		(e: React.MouseEvent) => {
			const id = getElementIdFromEvent(e);
			if (id) {
				cbRef.current.onClick(id, e);
			}
		},
		[cbRef],
	);

	const handleStageDblClick = useCallback(
		(e: React.MouseEvent) => {
			const id = getElementIdFromEvent(e);
			if (id) {
				cbRef.current.onDoubleClick(id, e);
			}
		},
		[cbRef],
	);

	// Set when a touch/pen pointer-down just handled a press, so the browser's
	// synthesized compatibility mousedown that follows is ignored (it would
	// otherwise re-initiate the drag/marquee a second time).
	const suppressNextMouseDownRef = useRef(false);

	const handleStageMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (suppressNextMouseDownRef.current) {
				suppressNextMouseDownRef.current = false;
				return;
			}
			const id = getElementIdFromEvent(e);
			if (id) {
				cbRef.current.onMouseDown(id, e);
				return;
			}
			onCanvasMouseDown?.(e);
		},
		[cbRef, onCanvasMouseDown],
	);

	/* ── Viewport-background press (empty workspace) ──────────────── */
	// The slide stage is centered inside a larger scrollable viewport, so clicks
	// in the blank space around the slide land on the viewport container itself.
	// Treat those direct hits like an empty stage click so selection clears;
	// bubbled child events (stage, rulers, handles, content) are ignored.
	const handleViewportMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (!isViewportBackgroundMouseDownTarget(e.target, e.currentTarget)) {
				return;
			}
			onCanvasMouseDown?.(e);
		},
		[onCanvasMouseDown],
	);

	/* ── Touch/pen press on the stage ─────────────────────────────── */
	// Mouse continues to use handleStageMouseDown (above) so desktop behaviour
	// is untouched. For touch/pen we run the same delegation here: capture the
	// pointer so the gesture keeps tracking off-target, then start an element
	// drag or a canvas marquee. Two quick taps on one element open inline edit
	// (native dblclick is unreliable on touch).
	const lastTapRef = useRef<{ id: string; time: number } | null>(null);
	const handleStagePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (e.pointerType === 'mouse') {
				return;
			}
			suppressNextMouseDownRef.current = true;
			(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
			const id = getElementIdFromEvent(e);
			if (id) {
				const now = e.timeStamp || Date.now();
				const last = lastTapRef.current;
				if (last && last.id === id && now - last.time < DOUBLE_TAP_MS) {
					lastTapRef.current = null;
					cbRef.current.onDoubleClick(id, e);
					return;
				}
				lastTapRef.current = { id, time: now };
				cbRef.current.onMouseDown(id, e);
				return;
			}
			lastTapRef.current = null;
			onCanvasMouseDown?.(e);
		},
		[cbRef, onCanvasMouseDown],
	);

	const handleStageContextMenu = useCallback(
		(e: React.MouseEvent) => {
			const id = getElementIdFromEvent(e);
			if (id) {
				cbRef.current.onContextMenu(id, e);
			}
		},
		[cbRef],
	);

	/* ── Guide drag state & handlers ─────────────────────────────── */
	const [draggingGuide, setDraggingGuide] = useState<DraggingGuide | null>(null);

	const handleStagePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingGuide || !onMoveGuide) {
				return;
			}
			const stage = zoom.canvasStageRef.current;
			if (!stage) {
				return;
			}
			const rect = stage.getBoundingClientRect();
			const scale = zoom.editorScale || 1;
			const rawPosition =
				draggingGuide.axis === 'h'
					? (e.clientY - rect.top) / scale
					: (e.clientX - rect.left) / scale;
			onMoveGuide(draggingGuide.id, rawPosition);
		},
		[draggingGuide, onMoveGuide, zoom.canvasStageRef, zoom.editorScale],
	);

	const handleStagePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingGuide) {
				return;
			}
			try {
				(e.currentTarget as HTMLElement).releasePointerCapture(draggingGuide.pointerId);
			} catch {
				// No-op: capture might already be released.
			}
			setDraggingGuide(null);
		},
		[draggingGuide],
	);

	return {
		elementFindHighlightsMap,
		selectedBounds,
		handleStageClick,
		handleStageDblClick,
		handleStageMouseDown,
		handleViewportMouseDown,
		handleStagePointerDown,
		handleStageContextMenu,
		draggingGuide,
		setDraggingGuide,
		handleStagePointerMove,
		handleStagePointerUp,
	};
}
