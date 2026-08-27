/**
 * Pure, framework-agnostic helpers for freehand ink drawing, shared by every
 * binding. No framework imports, so these can be unit-tested without TestBed.
 */
import type { InkPptxElement } from 'pptx-viewer-core';

import { hasPressureVariation } from './ink-rendering';

/** A 2D point in stage-local coordinates. */
export interface InkPoint {
	x: number;
	y: number;
	/**
	 * Pointer pressure at this point, from `PointerEvent.pressure` (0..1).
	 * Optional: a binding that has not wired pressure capture simply omits
	 * it, and {@link strokeToInkElement} falls back to
	 * {@link DEFAULT_POINTER_PRESSURE}, the constant value mice and other
	 * non-pressure-aware devices report, which reads as "no real pressure
	 * data".
	 */
	pressure?: number;
}

/**
 * `PointerEvent.pressure` reported by a mouse (or any device with no real
 * pressure sensor) while a button is held: a constant 0.5. Used as the
 * fallback for points a binding captured without a `pressure` field, and as
 * the baseline {@link strokeToInkElement} compares against to decide whether
 * a stroke carries genuine stylus pressure variation.
 */
export const DEFAULT_POINTER_PRESSURE = 0.5;

/**
 * Convert an array of points into an SVG path `d` attribute string.
 * - 0 points -> `''`
 * - 1 point  -> `'M x y'`
 * - N points -> `'M x0 y0 L x1 y1 L x2 y2 ...'`
 */
export function pointsToSvgPathD(points: InkPoint[]): string {
	if (points.length === 0) {
		return '';
	}
	const [first, ...rest] = points;
	const parts: string[] = [`M ${first.x} ${first.y}`];
	for (const pt of rest) {
		parts.push(`L ${pt.x} ${pt.y}`);
	}
	return parts.join(' ');
}

/** Options for {@link strokeToInkElement}. */
export interface StrokeToInkElementOpts {
	points: InkPoint[];
	color: string;
	width: number;
	tool: 'pen' | 'highlighter' | 'freeform';
}

/**
 * Convert a completed stroke (raw stage-coordinate points) into an
 * `InkPptxElement`.
 *
 * - Returns `null` when fewer than 2 points were captured (single tap).
 * - Computes the bounding box of all points, pads it by `width` px, and
 *   translates point coordinates to be relative to the bounding box origin.
 * - `freeform` is treated identically to `pen` (stored as inkTool: 'pen').
 * - `highlighter` gets `inkOpacities: [0.4]`; pen/freeform get `[1]`.
 * - When at least two points carry a `pressure` reading that actually varies
 *   (mirroring {@link DEFAULT_POINTER_PRESSURE}'s "no real data" baseline),
 *   the per-point pressure channel is attached as `inkPointPressures: [[...]]`
 *   so every binding's shared ink renderer (`ink-rendering.ts`) draws the
 *   stroke at variable width, identically to a stroke authored in React.
 */
export function strokeToInkElement(opts: StrokeToInkElementOpts): InkPptxElement | null {
	const { points, color, width, tool } = opts;
	if (points.length < 2) {
		return null;
	}

	// Compute bounding box over all raw points.
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

	// Pad by stroke width so the stroke never gets clipped at the bbox edge.
	const pad = width;
	minX -= pad;
	minY -= pad;
	maxX += pad;
	maxY += pad;

	const bboxWidth = Math.max(maxX - minX, 1);
	const bboxHeight = Math.max(maxY - minY, 1);

	// Translate points to bounding-box-relative coordinates.
	const relPoints: InkPoint[] = points.map((pt) => ({
		x: pt.x - minX,
		y: pt.y - minY,
	}));

	const pathD = pointsToSvgPathD(relPoints);
	const isHighlighter = tool === 'highlighter';
	const inkTool: 'pen' | 'highlighter' = isHighlighter ? 'highlighter' : 'pen';

	// A stroke only carries genuine pressure data when at least two points
	// report a value that actually differs from the constant every mouse (and
	// any non-pressure device) reports; a uniform reading is indistinguishable
	// from "not captured" and must not force every mouse-drawn stroke to a
	// wobbly variable width.
	const pressures = points.map((pt) => pt.pressure ?? DEFAULT_POINTER_PRESSURE);
	const hasPressure = hasPressureVariation(pressures);

	const ink: InkPptxElement = {
		id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		type: 'ink',
		x: minX,
		y: minY,
		width: bboxWidth,
		height: bboxHeight,
		inkPaths: [pathD],
		inkColors: [color],
		inkWidths: [width],
		inkOpacities: [isHighlighter ? 0.4 : 1],
		inkTool,
		...(hasPressure ? { inkPointPressures: [pressures] } : {}),
	};

	return ink;
}
