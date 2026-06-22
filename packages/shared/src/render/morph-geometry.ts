/**
 * Shape-geometry morphing for morph transitions.
 *
 * When a matched element changes shape type (or adjustment-driven outline)
 * between two slides, a plain crossfade looks abrupt. This module resolves both
 * shapes' outlines to polygons, normalises their point counts so they can be
 * interpolated vertex-by-vertex, and produces intermediate SVG path strings
 * across the transition parameter `t` in [0, 1]. Bindings inject the resulting
 * keyframes and animate the element's `clip-path`.
 *
 * Outline resolution reuses the framework-agnostic geometry already in
 * `pptx-viewer-shared`/`pptx-viewer-core`:
 *   - `getResolvedShapeClipPathFor` resolves a CSS `clip-path` for a shape.
 *   - `svgPathToPolygons` / `polygonsToSvgPath` convert `path(...)` outlines.
 * CSS `polygon(...)` / `ellipse(...)` / `circle(...)` / `inset(...)` forms are
 * sampled into polygons locally since the core path parser only handles `path`.
 *
 * @module render/morph-geometry
 */
import type { PptxElement } from 'pptx-viewer-core';
import { svgPathToPolygons } from 'pptx-viewer-core';

import { getResolvedShapeClipPathFor } from './shape-geometry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2D point in element-local pixel space. */
export interface MorphPoint {
	x: number;
	y: number;
}

/** Number of sample points each outline is resampled to before interpolating. */
export const OUTLINE_SAMPLE_COUNT = 64;

/** Number of points used to approximate an ellipse/circle outline. */
const ELLIPSE_SAMPLE_COUNT = 48;

// ---------------------------------------------------------------------------
// CSS clip-path -> polygon
// ---------------------------------------------------------------------------

/** Resolve a CSS length token (`50%`, `12px`, `8`) against an axis length. */
function resolveLength(token: string, axis: number): number {
	const trimmed = token.trim();
	if (trimmed.endsWith('%')) {
		const pct = Number.parseFloat(trimmed.slice(0, -1));
		return Number.isFinite(pct) ? (pct / 100) * axis : 0;
	}
	const px = Number.parseFloat(trimmed.replace(/px$/u, ''));
	return Number.isFinite(px) ? px : 0;
}

/** Parse a `polygon(x y, x y, ...)` clip-path into a pixel-space polygon. */
function polygonClipToPoints(value: string, width: number, height: number): MorphPoint[] {
	const inner = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'));
	const points: MorphPoint[] = [];
	for (const pairStr of inner.split(',')) {
		const parts = pairStr.trim().split(/\s+/u);
		if (parts.length < 2) {
			continue;
		}
		points.push({
			x: resolveLength(parts[0], width),
			y: resolveLength(parts[1], height),
		});
	}
	return points;
}

/** Parse an `inset(t r b l ...)` clip-path into a rectangle polygon. */
function insetClipToPoints(value: string, width: number, height: number): MorphPoint[] {
	const inner = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'));
	const tokens = inner.split(/round/u)[0].trim().split(/\s+/u);
	const top = resolveLength(tokens[0] ?? '0', height);
	const right = resolveLength(tokens[1] ?? tokens[0] ?? '0', width);
	const bottom = resolveLength(tokens[2] ?? tokens[0] ?? '0', height);
	const left = resolveLength(tokens[3] ?? tokens[1] ?? tokens[0] ?? '0', width);
	return [
		{ x: left, y: top },
		{ x: width - right, y: top },
		{ x: width - right, y: height - bottom },
		{ x: left, y: height - bottom },
	];
}

/** Sample an `ellipse(...)` / `circle(...)` clip-path into a polygon. */
function ellipseClipToPoints(value: string, width: number, height: number): MorphPoint[] {
	const isCircle = value.startsWith('circle');
	const inner = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'));
	const [radii, position] = inner.split(/\s+at\s+/u);
	const radiusTokens = radii.trim().split(/\s+/u).filter(Boolean);
	let rx = width / 2;
	let ry = height / 2;
	if (isCircle) {
		const r = resolveLength(radiusTokens[0] ?? '50%', Math.min(width, height));
		rx = r;
		ry = r;
	} else {
		rx = resolveLength(radiusTokens[0] ?? '50%', width);
		ry = resolveLength(radiusTokens[1] ?? radiusTokens[0] ?? '50%', height);
	}
	let cx = width / 2;
	let cy = height / 2;
	if (position) {
		const posTokens = position.trim().split(/\s+/u);
		cx = resolveLength(posTokens[0] ?? '50%', width);
		cy = resolveLength(posTokens[1] ?? posTokens[0] ?? '50%', height);
	}
	const points: MorphPoint[] = [];
	for (let i = 0; i < ELLIPSE_SAMPLE_COUNT; i++) {
		const a = (i / ELLIPSE_SAMPLE_COUNT) * Math.PI * 2;
		points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
	}
	return points;
}

/**
 * Convert a CSS `clip-path` value into a single pixel-space polygon. Supports
 * `polygon`, `inset`, `ellipse`, `circle`, and `path('...')` forms. For `path`
 * outlines the largest sub-path (by point count) is used.
 *
 * @param value  The CSS clip-path string.
 * @param width  Element width in pixels.
 * @param height Element height in pixels.
 * @returns The outline polygon, or an empty array if it cannot be parsed.
 */
export function clipPathToPolygon(value: string, width: number, height: number): MorphPoint[] {
	const v = value.trim();
	if (v.startsWith('polygon')) {
		return polygonClipToPoints(v, width, height);
	}
	if (v.startsWith('inset')) {
		return insetClipToPoints(v, width, height);
	}
	if (v.startsWith('ellipse') || v.startsWith('circle')) {
		return ellipseClipToPoints(v, width, height);
	}
	if (v.startsWith('path')) {
		const start = v.indexOf("'") >= 0 ? v.indexOf("'") : v.indexOf('"');
		const end = v.lastIndexOf("'") >= 0 ? v.lastIndexOf("'") : v.lastIndexOf('"');
		if (start >= 0 && end > start) {
			const d = v.slice(start + 1, end);
			const polys = svgPathToPolygons(d);
			if (polys.length === 0) {
				return [];
			}
			return polys.reduce((a, b) => (b.length > a.length ? b : a));
		}
	}
	return [];
}

// ---------------------------------------------------------------------------
// Element outline resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an element's outline polygon in its own pixel box. Falls back to the
 * element's bounding rectangle when no preset clip-path is available (e.g. a
 * plain `rect`, an image, or an unknown shape).
 *
 * @param element The element to resolve an outline for.
 * @returns A pixel-space polygon describing the element's outline.
 */
export function resolveElementOutline(element: PptxElement): MorphPoint[] {
	const width = Math.max(element.width, 1);
	const height = Math.max(element.height, 1);
	const shapeType = (element as { shapeType?: string }).shapeType;
	const adjustments = (element as { shapeAdjustments?: Record<string, number> }).shapeAdjustments;
	const clip = getResolvedShapeClipPathFor(shapeType, width, height, adjustments);
	if (clip) {
		const poly = clipPathToPolygon(clip, width, height);
		if (poly.length >= 3) {
			return poly;
		}
	}
	// Rectangle fallback (covers rect / roundrect / images / unmatched presets).
	return [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height },
	];
}
