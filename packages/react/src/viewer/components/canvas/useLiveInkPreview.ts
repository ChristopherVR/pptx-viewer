import type { InkPoint, InkStrokeView } from 'pptx-viewer-shared';
import { buildLiveInkStrokeView } from 'pptx-viewer-shared';
import { useMemo } from 'react';

import type { DrawingTool } from '../../types-ui';
import { buildCanvasPathD } from './canvas-path';

/** A 2D point in canvas-local (unscaled) coordinates. */
export interface CanvasPoint {
	x: number;
	y: number;
}

/** The in-progress Draw-tool stroke's live preview, split out of `useDrawingOverlay`. */
export interface LiveInkPreview {
	/** Plain polyline `d`, kept for a defensive fallback in `DrawingOverlaySvg`. */
	liveStrokeD: string;
	/**
	 * The in-progress stroke's render view: the same shared decision
	 * (`buildLiveInkStrokeView`) `renderInk` makes for a committed stroke, fed
	 * the same accumulated per-point pressure/tilt arrays
	 * `useDrawingOverlay`'s `handleDrawPointerUp` hands to `strokeToInkElement`.
	 * `null` while idle. `freeform` shares the pen's live look (it commits to a
	 * shape, not an `ink` element, but the in-progress preview is the same
	 * freehand line either way).
	 */
	liveStrokeView: InkStrokeView | null;
}

/**
 * Build the Draw tool's live in-progress preview from the currently
 * accumulated stroke points/pressure/tilt.
 *
 * Split out of `useDrawingOverlay` (which was pushing past this repo's
 * 300-LOC file guideline) because this is a distinct concern from gesture
 * capture: it only turns already-accumulated state into a render view, never
 * touches the pointer-event handlers or commits an element.
 */
export function useLiveInkPreview(
	isStrokeActive: boolean,
	activeTool: DrawingTool,
	points: CanvasPoint[],
	pressures: number[],
	tiltX: number[],
	tiltY: number[],
	color: string,
	width: number,
): LiveInkPreview {
	const liveStrokeD = useMemo(
		() => (isStrokeActive ? buildCanvasPathD(points) : ''),
		[isStrokeActive, points],
	);

	const liveStrokeView = useMemo<InkStrokeView | null>(() => {
		if (!isStrokeActive || activeTool === 'select' || activeTool === 'eraser') {
			return null;
		}
		const inkPoints: InkPoint[] = points.map((pt, i) => ({
			x: pt.x,
			y: pt.y,
			pressure: pressures[i],
			tiltX: tiltX[i],
			tiltY: tiltY[i],
		}));
		return buildLiveInkStrokeView({ points: inkPoints, color, width, tool: activeTool });
	}, [isStrokeActive, activeTool, points, pressures, tiltX, tiltY, color, width]);

	return { liveStrokeD, liveStrokeView };
}
