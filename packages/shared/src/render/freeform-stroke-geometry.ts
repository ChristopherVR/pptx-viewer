/**
 * `freeform-stroke-geometry`: turn the Draw tab's Freeform gesture (a list of
 * stage-local pointer positions) into an `a:custGeom` shape, shared by every
 * binding whose Freeform tool commits a real SHAPE rather than ink markup.
 *
 * Freeform is NOT ink. Ink is a stroke annotation with a pen tool, opacity and
 * pressure that PowerPoint treats as markup. A freeform is a drawing shape with
 * its own geometry, so it can be filled, given an outline style and reshaped
 * like any other shape afterwards. That is why it cannot go through
 * `strokeToInkElement` (`./ink-drawing`), which stores a freeform as pen ink.
 *
 * Path coordinates are emitted in the 1/100th-of-a-pixel space the parser and
 * renderer already agree on (`CustomGeometryPath.width`/`height` are the
 * path's own coordinate extent, not the element's box), relative to a box that
 * is padded by the stroke width so a thick outline is not clipped at its edge.
 *
 * Closing: PowerPoint's Freeform/Scribble produces an OPEN path unless the
 * gesture ends back on its start point. An open path still fills its implied
 * region, but no closing edge is stroked, so a squiggle that trails off must
 * NOT gain a straight line from its last point back to its first. The path is
 * therefore only closed when the stroke ends within
 * {@link freeformCloseTolerance} of where it began: a hand rarely lands on the
 * exact start pixel, and a thicker outline visually "touches" its own start
 * from further away, so the tolerance scales with the stroke width.
 *
 * @module render/freeform-stroke-geometry
 */
import type { CustomGeometryPath, CustomGeometrySegment, ShapePptxElement } from 'pptx-viewer-core';
import { createEditorId } from 'pptx-viewer-core';

/** A stage-local point of the gesture. `InkPoint` satisfies this structurally. */
export interface FreeformStrokePoint {
	x: number;
	y: number;
}

/** Path coordinates are stored at 100x element pixels, matching the geometry engine. */
export const FREEFORM_COORD_SCALE = 100;

/** Fewer points than this is a tap, not a drawing. */
export const FREEFORM_MIN_POINTS = 2;

/**
 * The closing tolerance is this many stroke widths: the end point may sit up
 * to three outline widths from the start and still count as "back on it".
 */
export const FREEFORM_CLOSE_TOLERANCE_FACTOR = 3;

/**
 * Floor for {@link freeformCloseTolerance}, in stage pixels, so a hairline
 * stroke does not demand a pixel-perfect return to its start.
 */
export const FREEFORM_CLOSE_TOLERANCE_MIN_PX = 4;

/** An element box plus the custom-geometry path drawn inside it. */
export interface FreeformStrokeGeometry {
	x: number;
	y: number;
	width: number;
	height: number;
	path: CustomGeometryPath;
	/** Whether the path was closed because the stroke returned to its start. */
	closed: boolean;
}

/** Tunables for {@link buildFreeformStrokeGeometry} / {@link buildFreeformShapeElement}. */
export interface FreeformStrokeOptions {
	/**
	 * Distance (stage px) within which the end point counts as "back on the
	 * start point". Defaults to {@link freeformCloseTolerance} of the width.
	 */
	closeTolerance?: number;
}

/** Stroke colour / width plus an optional explicit element id. */
export interface FreeformShapeOptions extends FreeformStrokeOptions {
	color: string;
	width: number;
	id?: string;
}

/**
 * How close (stage px) the end of a stroke must be to its start for the path
 * to be closed: {@link FREEFORM_CLOSE_TOLERANCE_FACTOR} stroke widths, never
 * less than {@link FREEFORM_CLOSE_TOLERANCE_MIN_PX}.
 */
export function freeformCloseTolerance(strokeWidth: number): number {
	return Math.max(FREEFORM_CLOSE_TOLERANCE_MIN_PX, strokeWidth * FREEFORM_CLOSE_TOLERANCE_FACTOR);
}

/**
 * Whether a stroke ends back on its start point (within `tolerance`). A
 * stroke of fewer than three points can never enclose anything, so it is
 * never closed no matter where its two ends sit.
 */
export function isFreeformStrokeClosed(
	points: readonly FreeformStrokePoint[],
	tolerance: number,
): boolean {
	if (points.length < 3) {
		return false;
	}
	const first = points[0];
	const last = points[points.length - 1];
	return Math.hypot(last.x - first.x, last.y - first.y) <= tolerance;
}

/**
 * Bounding box (padded by `strokeWidth`) plus the custom-geometry path for a
 * finished freeform stroke, or `null` for a tap (fewer than
 * {@link FREEFORM_MIN_POINTS} points).
 */
export function buildFreeformStrokeGeometry(
	points: readonly FreeformStrokePoint[],
	strokeWidth: number,
	options: FreeformStrokeOptions = {},
): FreeformStrokeGeometry | null {
	if (points.length < FREEFORM_MIN_POINTS) {
		return null;
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}
	minX -= strokeWidth;
	minY -= strokeWidth;
	maxX += strokeWidth;
	maxY += strokeWidth;
	const width = Math.max(maxX - minX, 1);
	const height = Math.max(maxY - minY, 1);

	const segments: CustomGeometrySegment[] = points.map((point, index) => {
		const pt = {
			x: Math.round((point.x - minX) * FREEFORM_COORD_SCALE),
			y: Math.round((point.y - minY) * FREEFORM_COORD_SCALE),
		};
		return index === 0 ? { type: 'moveTo', pt } : { type: 'lineTo', pt };
	});
	const closed = isFreeformStrokeClosed(
		points,
		options.closeTolerance ?? freeformCloseTolerance(strokeWidth),
	);
	if (closed) {
		segments.push({ type: 'close' });
	}

	return {
		x: minX,
		y: minY,
		width,
		height,
		path: {
			width: Math.round(width * FREEFORM_COORD_SCALE),
			height: Math.round(height * FREEFORM_COORD_SCALE),
			segments,
		},
		closed,
	};
}

/**
 * The `shape` element the Freeform tool commits: an unfilled `custom` shape
 * outlined in the pen colour, or `null` for a tap. Path closing follows
 * {@link buildFreeformStrokeGeometry}.
 */
export function buildFreeformShapeElement(
	points: readonly FreeformStrokePoint[],
	options: FreeformShapeOptions,
): ShapePptxElement | null {
	const geometry = buildFreeformStrokeGeometry(points, options.width, options);
	if (!geometry) {
		return null;
	}
	return {
		id: options.id ?? createEditorId('shape'),
		type: 'shape',
		x: geometry.x,
		y: geometry.y,
		width: geometry.width,
		height: geometry.height,
		shapeType: 'custom',
		shapeStyle: {
			fillColor: 'transparent',
			strokeColor: options.color,
			strokeWidth: options.width,
		},
		customGeometryPaths: [geometry.path],
		// The renderers paint a freeform from its aggregate SVG `pathData`; with
		// only the structured path the new shape drew as its bounding box until
		// the deck was saved and reopened.
		pathData: freeformPathToSvg(geometry.path),
		pathWidth: geometry.path.width,
		pathHeight: geometry.path.height,
	};
}

/** The straight-segment freeform path as SVG path data in its own space. */
function freeformPathToSvg(path: CustomGeometryPath): string {
	return path.segments
		.map((segment) => {
			if (segment.type === 'moveTo') {
				return `M ${segment.pt.x} ${segment.pt.y}`;
			}
			if (segment.type === 'lineTo') {
				return `L ${segment.pt.x} ${segment.pt.y}`;
			}
			return segment.type === 'close' ? 'Z' : '';
		})
		.filter(Boolean)
		.join(' ');
}
