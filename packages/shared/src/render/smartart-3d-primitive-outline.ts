/**
 * Polygon outlines for the two native SVG primitives the 2D SmartArt
 * projection draws directly (`RenderedShapeKind` `'rect'` and `'ellipse'`),
 * for the three.js flat/bevel SmartArt renderer, which needs a concrete
 * outline rather than an SVG primitive.
 *
 * @module render/smartart-3d-primitive-outline
 */
import type { Point2 } from './svg-path-flatten';

/**
 * Outline of an axis-aligned rectangle, optionally with rounded corners, as a
 * closed polygon (first point repeated at the end, matching
 * {@link flattenSvgPath}'s convention). `rx` is clamped to at most half the
 * smaller side.
 */
export function rectOutline(
	x: number,
	y: number,
	width: number,
	height: number,
	rx: number,
	cornerSegments = 6,
): Point2[] {
	const radius = Math.max(0, Math.min(rx, width / 2, height / 2));
	if (radius <= 0) {
		return [
			{ x, y },
			{ x: x + width, y },
			{ x: x + width, y: y + height },
			{ x, y: y + height },
			{ x, y },
		];
	}
	const points: Point2[] = [];
	const corners: Array<{ cx: number; cy: number; startDeg: number }> = [
		{ cx: x + width - radius, cy: y + radius, startDeg: -90 },
		{ cx: x + width - radius, cy: y + height - radius, startDeg: 0 },
		{ cx: x + radius, cy: y + height - radius, startDeg: 90 },
		{ cx: x + radius, cy: y + radius, startDeg: 180 },
	];
	for (const corner of corners) {
		for (let i = 0; i <= cornerSegments; i++) {
			const deg = corner.startDeg + (90 * i) / cornerSegments;
			const rad = (deg * Math.PI) / 180;
			points.push({
				x: corner.cx + radius * Math.cos(rad),
				y: corner.cy + radius * Math.sin(rad),
			});
		}
	}
	points.push(points[0]);
	return points;
}

/** Outline of an axis-aligned ellipse as a closed polygon. */
export function ellipseOutline(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	segments = 48,
): Point2[] {
	const points: Point2[] = [];
	for (let i = 0; i <= segments; i++) {
		const theta = (2 * Math.PI * i) / segments;
		points.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
	}
	return points;
}
