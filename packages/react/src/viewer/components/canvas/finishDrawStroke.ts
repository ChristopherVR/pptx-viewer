import type { CustomGeometrySegment, InkPptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { hasTiltData } from 'pptx-viewer-shared';

import type { DrawingTool } from '../../types-ui';
import { buildCanvasPathD } from './canvas-path';
import type { CanvasPoint } from './useLiveInkPreview';

/** The accumulated Draw-tool gesture state `finishDrawStroke` turns into an element. */
export interface FinishDrawStrokeInput {
	tool: DrawingTool;
	points: CanvasPoint[];
	pressures: number[];
	tiltX: number[];
	tiltY: number[];
	color: string;
	width: number;
}

/** The element a finished stroke commits, tagged by which kind it is. */
export type FinishedDrawStroke =
	| { kind: 'ink'; element: InkPptxElement }
	| { kind: 'freeform'; element: ShapePptxElement };

/**
 * Turn an accumulated Draw-tool stroke into a committed `ink` element or
 * `freeform` shape, or `null` for a too-short stroke (a plain tap).
 *
 * Split out of `useDrawingOverlay`'s `handleDrawPointerUp` (which was pushing
 * that file past this repo's 300-LOC guideline): pure geometry/element
 * construction with no React dependency, so it is unit-testable on its own.
 */
export function finishDrawStroke(input: FinishDrawStrokeInput): FinishedDrawStroke | null {
	const { tool, points, pressures, tiltX, tiltY, color, width } = input;
	if (points.length < 2) {
		return null;
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const pt of points) {
		if (pt.x < minX) {
			minX = pt.x;
		}
		if (pt.y < minY) {
			minY = pt.y;
		}
		if (pt.x > maxX) {
			maxX = pt.x;
		}
		if (pt.y > maxY) {
			maxY = pt.y;
		}
	}
	const pad = width;
	minX -= pad;
	minY -= pad;
	maxX += pad;
	maxY += pad;
	const w = Math.max(maxX - minX, 1);
	const h = Math.max(maxY - minY, 1);
	const relPoints = points.map((pt) => ({ x: pt.x - minX, y: pt.y - minY }));

	if (tool === 'freeform') {
		return {
			kind: 'freeform',
			element: buildFreeformShape(relPoints, { x: minX, y: minY, w, h }, color, width),
		};
	}
	return {
		kind: 'ink',
		element: buildInkElement(
			relPoints,
			{ x: minX, y: minY, w, h },
			tool,
			{ pressures, tiltX, tiltY },
			color,
			width,
		),
	};
}

interface StrokeBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

function buildFreeformShape(
	relPoints: CanvasPoint[],
	box: StrokeBox,
	color: string,
	width: number,
): ShapePptxElement {
	const COORD_SCALE = 100;
	const segments: CustomGeometrySegment[] = [];
	for (let i = 0; i < relPoints.length; i++) {
		const scaledPt = {
			x: Math.round(relPoints[i].x * COORD_SCALE),
			y: Math.round(relPoints[i].y * COORD_SCALE),
		};
		segments.push(i === 0 ? { type: 'moveTo', pt: scaledPt } : { type: 'lineTo', pt: scaledPt });
	}
	// Close the path for a proper freeform polygon.
	if (segments.length > 2) {
		segments.push({ type: 'close' });
	}
	return {
		id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		type: 'shape',
		x: box.x,
		y: box.y,
		width: box.w,
		height: box.h,
		shapeType: 'custom',
		shapeStyle: { fillColor: 'transparent', strokeColor: color, strokeWidth: width },
		customGeometryPaths: [
			{ width: Math.round(box.w * COORD_SCALE), height: Math.round(box.h * COORD_SCALE), segments },
		],
	};
}

function buildInkElement(
	relPoints: CanvasPoint[],
	box: StrokeBox,
	tool: DrawingTool,
	channels: { pressures: number[]; tiltX: number[]; tiltY: number[] },
	color: string,
	width: number,
): InkPptxElement {
	const pathD = buildCanvasPathD(relPoints);
	const isHighlighter = tool === 'highlighter';
	// Check if we have meaningful pressure variation from the stylus/pen. A
	// uniform pressure of 0.5 (the default for mouse input) means no real
	// pressure data was captured.
	const { pressures, tiltX, tiltY } = channels;
	const hasPressure =
		pressures.length >= 2 && pressures.some((p) => Math.abs(p - pressures[0]) > 0.01);
	// Tilt uses the shared predicate (not a hand-rolled variation check):
	// unlike pressure, a constant non-zero lean across the whole stroke is
	// still real data, so "any point differs from (0, 0)" is the right test,
	// not "varies across points".
	const hasTilt = hasTiltData(tiltX, tiltY);
	return {
		id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		type: 'ink',
		x: box.x,
		y: box.y,
		width: box.w,
		height: box.h,
		inkPaths: [pathD],
		inkColors: [color],
		inkWidths: [width],
		inkOpacities: [isHighlighter ? 0.4 : 1],
		inkTool: isHighlighter ? 'highlighter' : 'pen',
		...(hasPressure ? { inkPointPressures: [pressures] } : {}),
		...(hasTilt ? { inkPointTiltX: [tiltX], inkPointTiltY: [tiltY] } : {}),
	};
}
