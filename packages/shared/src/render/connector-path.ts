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

import type { ConnectorArrowType, PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR } from '../constants';
import { routeOrthogonalConnector, waypointsToPathD } from './connector-router';
import type { RouterRect } from './connector-router';
import {
	connectorKind,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	svgLineCap,
} from './connector-style';
import { getSvgStrokeDasharray, normalizeStrokeDashType } from './element-style-transform';

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

/** A single custom-dash segment (percent-of-line-width, 1000ths of a percent). */
export interface DashSegment {
	dash: number;
	space: number;
}

/** Arrow head size token (`a:ln/a:headEnd|tailEnd/@w|@len`). */
export type ArrowSize = 'sm' | 'med' | 'lg';

/** Shape description for a SVG `<marker>` element (viewBox 0 0 10 10). */
export interface MarkerShape {
	shape: 'path' | 'circle';
	d?: string;
	/**
	 * Suggested `markerWidth` (along the line: arrow *length*). Derived from the
	 * connector's `@len` size token. Bindings should apply this instead of a
	 * hard-coded value so `sm`/`lg` arrows scale. Defaults to the historical `4`.
	 */
	markerWidth: number;
	/** Suggested `markerHeight` (perpendicular: arrow *width*, from `@w`). */
	markerHeight: number;
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
	let pathD = buildConnectorPathD(shapeType, x1, y1, x2, y2, connectorBendFraction(element));

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
		wrapperStyle,
	};
}

/**
 * Return the SVG `stroke-dasharray` string for a given OOXML stroke dash preset
 * and width, or `undefined` for solid lines (no attribute needed).
 *
 * Produces a distinct pattern per preset (`dash`, `lgDash`, `dashDot`,
 * `sysDashDotDot`, etc.) rather than collapsing every non-dot preset to a single
 * `3w/w` approximation, and honours a `custDash` segment list (`a:custDash/a:ds`)
 * when supplied. This delegates to the same {@link getSvgStrokeDasharray} the
 * shape/border code uses, so connectors and shape outlines stay in lock-step.
 *
 * @param dash               Raw `a:ln/@prstDash` token (e.g. `"lgDashDot"`).
 * @param strokeWidth        Resolved stroke width in px.
 * @param customDashSegments Optional `custDash` segments; when present they take
 *                           precedence and are rendered as an explicit pattern.
 */
export function buildDashArray(
	dash: string | undefined,
	strokeWidth: number,
	customDashSegments?: ReadonlyArray<DashSegment>,
): string | undefined {
	const segments =
		customDashSegments && customDashSegments.length > 0
			? customDashSegments.map((seg) => ({ dash: seg.dash, space: seg.space }))
			: undefined;
	// A `custDash` implies the `custom` dash family even when no `@prstDash`
	// token was authored alongside it.
	const dashType = segments ? 'custom' : normalizeStrokeDashType(dash);
	return getSvgStrokeDasharray(dashType, strokeWidth, segments);
}

/**
 * Normalise a connector's first adjustment value (`adj1`/`adj`) to a 0..1
 * fraction that positions the elbow / curve mid-axis. OOXML stores these in
 * 1000ths of a percent (0..100000); values already in 0..1 are passed through.
 * Defaults to the midpoint (`0.5`) when no usable adjustment is present.
 */
export function connectorBendFraction(element: PptxElement): number {
	const adj = (element as { shapeAdjustments?: Record<string, number> }).shapeAdjustments;
	const raw = adj?.adj1 ?? adj?.adj;
	if (typeof raw !== 'number' || !Number.isFinite(raw)) {
		return 0.5;
	}
	const fraction = Math.abs(raw) > 1 ? raw / 100000 : raw;
	return Math.min(1, Math.max(0, fraction));
}

/**
 * Build the SVG `path` data for a bent or curved connector, or `undefined`
 * for straight connectors (which render as a `<line>`). Endpoints are already
 * flip-adjusted by the caller.
 *
 * Viewer-first approximation (full A* routing is a TODO):
 *  - **bent**: orthogonal elbow polyline. `bentConnector2` is a single L-bend;
 *    `bentConnector3..5` route through a vertical mid-axis at `bend`.
 *  - **curved**: `curvedConnector2` is a quadratic Bezier; `curvedConnector3..5`
 *    are a cubic S-curve with control points on the mid-axis.
 */
export function buildConnectorPathD(
	shapeType: string | undefined,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	bend: number,
): string | undefined {
	const kind = connectorKind(shapeType);
	if (kind === 'straight') {
		return undefined;
	}
	const t = (shapeType ?? '').toLowerCase();
	// x of the vertical mid-axis the elbow / control points pivot around.
	const mx = x1 + (x2 - x1) * bend;

	if (kind === 'bent') {
		if (t.includes('bentconnector2')) {
			return `M${x1},${y1} L${x2},${y1} L${x2},${y2}`;
		}
		return `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
	}

	// curved
	if (t.includes('curvedconnector2')) {
		return `M${x1},${y1} Q${x2},${y1} ${x2},${y2}`;
	}
	return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

/**
 * Base `markerWidth`/`markerHeight` (in `strokeWidth` units) for a `med` arrow.
 * `sm`/`lg` scale relative to this, mirroring PowerPoint's discrete sizes and
 * the React binding's `ARROW_SIZE_SCALE`.
 */
const ARROW_BASE_MARKER_SIZE = 4;
const ARROW_SIZE_SCALE: Record<ArrowSize, number> = { sm: 0.6, med: 1, lg: 1.5 };

/**
 * Map a `ConnectorArrowType` value to its SVG marker shape, scaling the marker
 * box by the arrow's width (`@w`) and length (`@len`) size tokens.
 *
 * The `<marker>` viewBox stays `0 0 10 10`; the returned {@link MarkerShape}
 * carries `markerWidth` (length, along the line) and `markerHeight` (width,
 * perpendicular) so bindings render `sm`/`med`/`lg` arrows at the right size
 * instead of a single fixed dimension.
 *
 * @param type        Arrow head shape.
 * @param arrowWidth  `@w` size token (perpendicular thickness). Defaults `med`.
 * @param arrowLength `@len` size token (length along the line). Defaults `med`.
 */
export function markerPath(
	type: ConnectorArrowType,
	arrowWidth?: ArrowSize,
	arrowLength?: ArrowSize,
): MarkerShape {
	const markerWidth = ARROW_BASE_MARKER_SIZE * (ARROW_SIZE_SCALE[arrowLength ?? 'med'] ?? 1);
	const markerHeight = ARROW_BASE_MARKER_SIZE * (ARROW_SIZE_SCALE[arrowWidth ?? 'med'] ?? 1);
	const box = { markerWidth, markerHeight };
	switch (type) {
		case 'diamond':
			return { shape: 'path', d: 'M5 0 L10 5 L5 10 L0 5 Z', ...box };
		case 'oval':
			return { shape: 'circle', ...box };
		case 'stealth':
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 L3 5 Z', ...box };
		// triangle / arrow / fallback
		default:
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 Z', ...box };
	}
}

/** Normalise a raw arrow type value: coerce `"none"` / `undefined` → `undefined`. */
export function normalizeArrow(a: ConnectorArrowType | undefined): ConnectorArrowType | undefined {
	return a && a !== 'none' ? a : undefined;
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
	if (element.rotation) {
		// Flip is handled via endpoints; only rotation goes on the transform.
		parts.push(`transform:rotate(${element.rotation}deg)`);
	}
	if (typeof element.opacity === 'number') {
		parts.push(`opacity:${element.opacity}`);
	}
	if (element.hidden) {
		parts.push('display:none');
	}
	return parts.join(';');
}
