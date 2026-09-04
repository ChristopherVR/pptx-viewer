/**
 * Pure, framework-agnostic connector-geometry helpers shared across bindings.
 *
 * Derives the full set of SVG rendering values for a connector `PptxElement`:
 * stroke style, flip-adjusted endpoints, bent/curved path data (with optional
 * obstacle-avoiding A* routing), and arrow `<marker>` shapes. No framework
 * imports; the actual `<svg>`/`<marker>`/`<path>` emission stays in each
 * binding's view layer.
 *
 * Connector-family classification (`connectorKind` / `ConnectorKind`) lives in
 * `connector-style.ts` and is re-used here rather than re-declared.
 */

import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR } from '../constants';
import { buildDashArray } from './connector-dash';
import {
	connectorAdjustmentFraction,
	curvedElbowPathD,
	elbowSegmentCount,
	elbowWaypoints,
} from './connector-elbow-geometry';
import { connectorHitStrokeWidth } from './connector-hit-target';
import { markerPath, normalizeArrow } from './connector-markers';
import type { MarkerShape } from './connector-markers';
import { routeOrthogonalConnector, waypointsToPathD } from './connector-router';
import type { RouterRect } from './connector-router';
import {
	connectorKind,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	svgLineCap,
} from './connector-style';

// Re-exported so the historical `render/connector-path` import surface (and the
// package barrel, which spreads this module) still carries the hit-target rule
// and the arrow-head marker shapes, both of which now live in their own modules.
export { CONNECTOR_HIT_MIN_WIDTH, connectorHitStrokeWidth } from './connector-hit-target';
export { markerPath, normalizeArrow } from './connector-markers';
export type { ArrowSize, MarkerShape } from './connector-markers';
export { buildDashArray } from './connector-dash';
export type { DashSegment } from './connector-dash';
export { connectorAdjustmentFraction, connectorBendFraction } from './connector-elbow-geometry';
export type { ElbowSegments } from './connector-elbow-geometry';

/**
 * Optional obstacle-avoidance routing context for bent connectors. When
 * supplied with a non-empty obstacle list, a bent connector's elbow path is
 * replaced by an A* orthogonal route that detours around the obstacle rects
 * (absolute slide coordinates). Straight/curved connectors ignore this.
 */
export interface ConnectorRouting {
	obstacles: ReadonlyArray<RouterRect>;
	canvasWidth: number;
	canvasHeight: number;
}

/** All derived connector rendering values, computed from a `PptxElement`. */
export interface ConnectorGeometry {
	strokeWidth: number;
	strokeColor: string;
	strokeOpacity: number;
	dashArray: string | undefined;
	/** SVG `stroke-linecap`, derived from the connector's `a:ln/@cap`. */
	strokeLinecap: 'butt' | 'round' | 'square';
	/**
	 * Perpendicular offsets (px) for each parallel strand of a compound
	 * (double/triple) line. A single line yields `[0]`. Strands render the same
	 * path/line translated vertically by each offset.
	 */
	compoundOffsets: number[];
	/** Per-strand stroke widths, index-aligned with {@link compoundOffsets}. */
	compoundWidths: number[];
	/** SVG width (clamped to at least 1). */
	svgW: number;
	/** SVG height (clamped to at least 1). */
	svgH: number;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	/**
	 * SVG `path` data for bent / curved connectors. `undefined` for straight
	 * connectors, in which case the component renders a `<line>` from
	 * `(x1,y1)` to `(x2,y2)` instead.
	 */
	pathD: string | undefined;
	startMarkerId: string;
	endMarkerId: string;
	startMarker: MarkerShape | null;
	endMarker: MarkerShape | null;
	startMarkerRef: string | null;
	endMarkerRef: string | null;
	/**
	 * `path` data for the invisible pointer target that runs along the stroke.
	 * Always set: it is {@link pathD} for a bent/curved connector, and the
	 * straight `(x1,y1) -> (x2,y2)` segment otherwise, so a binding can emit one
	 * `<path>` for the hit target regardless of which shape it paints.
	 */
	hitPathD: string;
	/** `stroke-width` for the hit target. See {@link connectorHitStrokeWidth}. */
	hitStrokeWidth: number;
	/** Inline `style` string for the wrapper `<div>`. */
	wrapperStyle: string;
}

/**
 * Derive all rendering geometry for a connector element.
 *
 * This is a pure function: no side-effects, no framework imports. The component
 * calls this once per change-detection cycle inside a `computed()`.
 */
export function buildConnectorGeometry(
	element: PptxElement,
	zIndex: number,
	routing?: ConnectorRouting,
): ConnectorGeometry {
	const ss = hasShapeProperties(element) ? element.shapeStyle : undefined;

	const strokeWidth = Math.max(0, ss?.strokeWidth ?? 2);
	const strokeColor = ss?.strokeColor ?? DEFAULT_STROKE_COLOR;
	const strokeOpacity = ss?.strokeOpacity ?? 1;
	const dashArray = buildDashArray(ss?.strokeDash, strokeWidth, ss?.customDashSegments);
	const strokeLinecap = svgLineCap(ss?.lineCap);
	const compoundOffsets = getCompoundLineOffsets(ss?.compoundLine, strokeWidth);
	const compoundWidths = getCompoundLineWidths(ss?.compoundLine, strokeWidth);

	const svgW = Math.max(element.width, 1);
	const svgH = Math.max(element.height, 1);

	const x1 = element.flipHorizontal ? svgW : 0;
	const y1 = element.flipVertical ? svgH : 0;
	const x2 = element.flipHorizontal ? 0 : svgW;
	const y2 = element.flipVertical ? 0 : svgH;

	const shapeType = (element as { shapeType?: string }).shapeType;
	const bend1 = connectorAdjustmentFraction(element, 'adj1', 0.5);
	const bend2 = connectorAdjustmentFraction(element, 'adj2', 0.5);
	const bend3 = connectorAdjustmentFraction(element, 'adj3', 0.5);
	let pathD = buildConnectorPathD(shapeType, x1, y1, x2, y2, bend1, bend2, bend3);

	// Obstacle-avoiding A* routing for bent connectors. Routes in absolute slide
	// coordinates (so it can detour outside the connector's own bounding box;
	// the SVG uses `overflow: visible`), then translates waypoints back to
	// element-local space for the path data.
	if (
		routing &&
		routing.obstacles.length > 0 &&
		connectorKind(shapeType) === 'bent' &&
		(element.width > 0 || element.height > 0)
	) {
		const start = { x: element.x + x1, y: element.y + y1 };
		const end = { x: element.x + x2, y: element.y + y2 };
		const waypoints = routeOrthogonalConnector(start, end, routing.obstacles, {
			canvasWidth: routing.canvasWidth,
			canvasHeight: routing.canvasHeight,
		});
		if (waypoints.length > 2) {
			const local = waypoints.map((p) => ({ x: p.x - element.x, y: p.y - element.y }));
			pathD = waypointsToPathD(local);
		}
	}

	const markerSeed = element.id.replace(/[^a-zA-Z0-9_-]/gu, '_');
	const startMarkerId = `${markerSeed}-start`;
	const endMarkerId = `${markerSeed}-end`;

	const startArrow = normalizeArrow(ss?.connectorStartArrow);
	const endArrow = normalizeArrow(ss?.connectorEndArrow);

	const startMarker = startArrow
		? markerPath(startArrow, ss?.connectorStartArrowWidth, ss?.connectorStartArrowLength)
		: null;
	const endMarker = endArrow
		? markerPath(endArrow, ss?.connectorEndArrowWidth, ss?.connectorEndArrowLength)
		: null;

	const startMarkerRef = startMarker ? `url(#${startMarkerId})` : null;
	const endMarkerRef = endMarker ? `url(#${endMarkerId})` : null;

	const wrapperStyle = buildWrapperStyle(element, zIndex);

	return {
		strokeWidth,
		strokeColor,
		strokeOpacity,
		dashArray,
		strokeLinecap,
		compoundOffsets,
		compoundWidths,
		svgW,
		svgH,
		x1,
		y1,
		x2,
		y2,
		pathD,
		startMarkerId,
		endMarkerId,
		startMarker,
		endMarker,
		startMarkerRef,
		endMarkerRef,
		// A straight connector has no `pathD`, so the hit target falls back to its
		// endpoints; both forms are a `path`, which keeps the binding templates to
		// a single node instead of a line/path branch of their own.
		hitPathD: pathD ?? `M${x1},${y1} L${x2},${y2}`,
		hitStrokeWidth: connectorHitStrokeWidth(strokeWidth),
		wrapperStyle,
	};
}

/**
 * Build the SVG `path` data for a bent or curved connector, or `undefined`
 * for straight connectors (which render as a `<line>`). Endpoints are already
 * flip-adjusted by the caller.
 *
 * PowerPoint's elbow connectors do not avoid obstacles (that A* routing is
 * applied separately by {@link buildConnectorGeometry} when a binding
 * supplies an obstacle list). What they DO is pick the bend axis from the
 * actual relative position of the two endpoints, and use the OOXML preset's
 * full segment count and adjustment values rather than collapsing every
 * `bentConnector3/4/5` (and `curvedConnector3/4/5`) into the same shape; see
 * `connector-elbow-geometry.ts` for the orientation/segment-count formulas
 * (mirroring `packages/core/src/core/geometry/connector-geometry.ts`'s
 * per-segment-count treatment, extended with the orientation choice):
 *  - **bent**: orthogonal elbow polyline. `bentConnector2` is a single L-bend;
 *    `bentConnector3` is a 2-bend Z routed through one adjustment (`adj1`);
 *    `bentConnector4` is a 3-bend staircase (`adj1`, `adj2`); `bentConnector5`
 *    is a 4-bend staircase (`adj1`, `adj2`, `adj3`).
 *  - **curved**: `curvedConnector2` is a quadratic Bezier; `curvedConnector3/4/5`
 *    are the same elbow shapes rendered as smooth cubic Beziers instead of
 *    sharp corners.
 *
 * `bend2`/`bend3` are optional so existing 6-argument call sites (which only
 * ever needed `bentConnector2/3` / `curvedConnector2/3`) keep compiling and
 * producing identical output; they default to the spec midpoint (`0.5`).
 */
export function buildConnectorPathD(
	shapeType: string | undefined,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	bend: number,
	bend2 = 0.5,
	bend3 = 0.5,
): string | undefined {
	const kind = connectorKind(shapeType);
	if (kind === 'straight') {
		return undefined;
	}
	const t = (shapeType ?? '').toLowerCase();

	if (kind === 'bent') {
		if (t.includes('bentconnector2')) {
			return `M${x1},${y1} L${x2},${y1} L${x2},${y2}`;
		}
		const segments = elbowSegmentCount(t);
		const points = elbowWaypoints(x1, y1, x2, y2, segments, bend, bend2, bend3);
		return waypointsToPathD(points);
	}

	// curved
	if (t.includes('curvedconnector2')) {
		return `M${x1},${y1} Q${x2},${y1} ${x2},${y2}`;
	}
	const segments = elbowSegmentCount(t);
	return curvedElbowPathD(x1, y1, x2, y2, segments, bend, bend2, bend3);
}

/**
 * The connector wrapper's CSS `transform` value: rotation only, never flip.
 *
 * A connector's `flipHorizontal`/`flipVertical` is already baked into its
 * endpoints (`buildConnectorGeometry`'s `x1/y1/x2/y2`, which swap per flip
 * flag), so re-applying the flip as a `scaleX(-1)`/`scaleY(-1)` on the
 * wrapper would cancel it back out. Every binding must build its wrapper
 * transform through this one function rather than the general-purpose
 * `getElementTransform` (which DOES include flip, for every other element
 * type) or the flip cancels silently; see CLAUDE.md Rule 2 and the G0 fix in
 * the OpenXML parity audit.
 */
export function connectorWrapperTransform(element: PptxElement): string | undefined {
	return element.rotation ? `rotate(${element.rotation}deg)` : undefined;
}

/**
 * Build the inline `style` string for the connector wrapper `<div>`.
 * Position, size, z-index, rotation, opacity, and visibility.
 */
export function buildWrapperStyle(element: PptxElement, zIndex: number): string {
	const parts: string[] = [
		'position:absolute',
		`left:${element.x}px`,
		`top:${element.y}px`,
		`width:${element.width}px`,
		`height:${element.height}px`,
		`z-index:${zIndex}`,
		'pointer-events:none',
		'overflow:visible',
	];
	const transform = connectorWrapperTransform(element);
	if (transform) {
		parts.push(`transform:${transform}`);
	}
	if (typeof element.opacity === 'number') {
		parts.push(`opacity:${element.opacity}`);
	}
	if (element.hidden) {
		parts.push('display:none');
	}
	return parts.join(';');
}
