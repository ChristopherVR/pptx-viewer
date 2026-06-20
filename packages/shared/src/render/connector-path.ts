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
import { connectorKind } from './connector-style';

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

/** Shape description for a SVG `<marker>` element (viewBox 0 0 10 10). */
export interface MarkerShape {
	shape: 'path' | 'circle';
	d?: string;
}

/** All derived connector rendering values, computed from a `PptxElement`. */
export interface ConnectorGeometry {
	strokeWidth: number;
	strokeColor: string;
	strokeOpacity: number;
	dashArray: string | undefined;
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
	const dashArray = buildDashArray(ss?.strokeDash, strokeWidth);

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

	const startMarker = startArrow ? markerPath(startArrow) : null;
	const endMarker = endArrow ? markerPath(endArrow) : null;

	const startMarkerRef = startMarker ? `url(#${startMarkerId})` : null;
	const endMarkerRef = endMarker ? `url(#${endMarkerId})` : null;

	const wrapperStyle = buildWrapperStyle(element, zIndex);

	return {
		strokeWidth,
		strokeColor,
		strokeOpacity,
		dashArray,
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
 * Return the dash-array string for a given stroke dash type and width,
 * or `undefined` for solid lines (no attribute needed).
 */
export function buildDashArray(dash: string | undefined, strokeWidth: number): string | undefined {
	const w = Math.max(strokeWidth, 1);
	if (!dash || dash === 'solid') {
		return undefined;
	}
	if (dash === 'dot' || dash === 'sysDot') {
		return `${w} ${w}`;
	}
	return `${w * 3} ${w}`;
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
 * Viewer-first approximation (full A* routing is a TODO, see PORTING.md):
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
 * Map a `ConnectorArrowType` value to its SVG marker shape.
 * The viewBox used in the `<marker>` element is `0 0 10 10`.
 */
export function markerPath(type: ConnectorArrowType): MarkerShape {
	switch (type) {
		case 'diamond':
			return { shape: 'path', d: 'M5 0 L10 5 L5 10 L0 5 Z' };
		case 'oval':
			return { shape: 'circle' };
		case 'stealth':
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 L3 5 Z' };
		// triangle / arrow / fallback
		default:
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 Z' };
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
