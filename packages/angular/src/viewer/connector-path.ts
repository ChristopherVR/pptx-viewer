/**
 * Pure, framework-agnostic helpers for rendering connector elements.
 *
 * These are extracted from the component so they can be unit-tested without
 * the Angular compiler or TestBed (the vitest setup for this package is
 * plain happy-dom, no Analog plugin yet — see PORTING.md).
 *
 * Mirror of the Vue `ConnectorRenderer.vue` helpers and the React
 * `ConnectorElementRenderer` path logic (basic straight-line subset).
 */

import type { ConnectorArrowType, PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR } from '../internal/shared';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
	startMarkerId: string;
	endMarkerId: string;
	startMarker: MarkerShape | null;
	endMarker: MarkerShape | null;
	startMarkerRef: string | null;
	endMarkerRef: string | null;
	/** Inline `style` string for the wrapper `<div>`. */
	wrapperStyle: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive all rendering geometry for a connector element.
 *
 * This is a pure function: no side-effects, no Angular/Vue/React imports.
 * The component calls this once per change-detection cycle inside a `computed()`.
 */
export function buildConnectorGeometry(element: PptxElement, zIndex: number): ConnectorGeometry {
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
		startMarkerId,
		endMarkerId,
		startMarker,
		endMarker,
		startMarkerRef,
		endMarkerRef,
		wrapperStyle,
	};
}

// ---------------------------------------------------------------------------
// Internal helpers (also exported for tests)
// ---------------------------------------------------------------------------

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
