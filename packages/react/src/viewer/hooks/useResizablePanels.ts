/**
 * useResizablePanels: Manages widths/heights for resizable viewer panels.
 *
 * Stores the current sizes for the left sidebar, right inspector, and
 * bottom notes panel. Provides resize callbacks that enforce min/max
 * constraints.
 */
import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

/** Left sidebar (slides pane). */
const LEFT_MIN = 120;
const LEFT_MAX = 400;
const LEFT_DEFAULT = 180;

/** Right inspector panel. */
const RIGHT_MIN = 220;
const RIGHT_MAX = 480;
const RIGHT_DEFAULT = 288; // w-72

/** Bottom notes panel. */
const BOTTOM_MIN = 60;
const BOTTOM_MAX = 400;
const BOTTOM_DEFAULT = 120;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface ResizablePanelSizes {
	leftWidth: number;
	rightWidth: number;
	bottomHeight: number;
}

export interface UseResizablePanelsResult extends ResizablePanelSizes {
	onResizeLeft: (delta: number) => void;
	onResizeRight: (delta: number) => void;
	onResizeBottom: (delta: number) => void;
}

export function useResizablePanels(): UseResizablePanelsResult {
	const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
	const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
	const [bottomHeight, setBottomHeight] = useState(BOTTOM_DEFAULT);

	const onResizeLeft = useCallback((delta: number) => {
		setLeftWidth((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + delta)));
	}, []);

	const onResizeRight = useCallback((delta: number) => {
		// Dragging left → negative delta → panel grows
		setRightWidth((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w - delta)));
	}, []);

	const onResizeBottom = useCallback((delta: number) => {
		// Dragging up → negative delta → panel grows
		setBottomHeight((h) => Math.min(BOTTOM_MAX, Math.max(BOTTOM_MIN, h - delta)));
	}, []);

	return {
		leftWidth,
		rightWidth,
		bottomHeight,
		onResizeLeft,
		onResizeRight,
		onResizeBottom,
	};
}
