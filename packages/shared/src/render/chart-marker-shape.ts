/**
 * chart-marker-shape.ts: framework-agnostic marker-symbol primitive builder for
 * line / scatter / area chart data points.
 *
 * OOXML line/scatter series carry a `c:marker` with a `c:symbol` (circle,
 * diamond, square, triangle, star, x, plus, dot, dash, none, ...) and an
 * optional `c:size` (2-72 points). The base view-model historically drew every
 * data point as a fixed-radius circle, ignoring both. This helper resolves the
 * parsed marker into the correct `SvgPrimitive` at the requested size, and
 * returns `null` for `symbol === 'none'` so no dot is drawn.
 *
 * @module chart-marker-shape
 */

import type { PptxChartMarkerSymbol } from 'pptx-viewer-core';

import type { ChartPartRef, SvgCircle, SvgPath, SvgPolygon, SvgRect } from './chart-view-model';

/** The concrete primitive kinds a marker can resolve to (all support `opacity`). */
export type MarkerPrimitive = SvgCircle | SvgRect | SvgPath | SvgPolygon;

/** Inputs for a single marker primitive. */
export interface MarkerShapeInput {
	/** Parsed marker symbol; `undefined` falls back to the default dot. */
	symbol: PptxChartMarkerSymbol | undefined;
	/** Parsed marker size in points (diameter). `undefined` uses `defaultRadius`. */
	size: number | undefined;
	cx: number;
	cy: number;
	fill: string;
	/** Radius used when no marker size is present (preserves the legacy dot size). */
	defaultRadius: number;
	part?: ChartPartRef;
}

/** Resolve the drawn radius (px) from the parsed point size or the default. */
function markerRadius(size: number | undefined, defaultRadius: number): number {
	if (size === undefined || !Number.isFinite(size) || size <= 0) {
		return defaultRadius;
	}
	// OOXML marker size is a point diameter; treat 1pt ~ 1px at chart scale.
	return size / 2;
}

/** Build the SVG points string for a regular/irregular polygon vertex list. */
function polygonPoints(vertices: ReadonlyArray<[number, number]>): string {
	return vertices.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function starVertices(cx: number, cy: number, r: number): Array<[number, number]> {
	const inner = r * 0.5;
	const out: Array<[number, number]> = [];
	for (let i = 0; i < 10; i++) {
		const radius = i % 2 === 0 ? r : inner;
		const angle = -Math.PI / 2 + (Math.PI * i) / 5;
		out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
	}
	return out;
}

/**
 * Build the marker primitive for one data point, honouring `symbol` and `size`.
 * Returns `null` when `symbol === 'none'` (draw nothing).
 */
export function buildMarkerPrimitive(input: MarkerShapeInput): MarkerPrimitive | null {
	const { symbol, cx, cy, fill, part } = input;
	if (symbol === 'none') {
		return null;
	}
	const r = markerRadius(input.size, input.defaultRadius);
	const stroke = fill;

	switch (symbol) {
		case 'square':
			return { kind: 'rect', x: cx - r, y: cy - r, w: r * 2, h: r * 2, fill, part };
		case 'dash':
			return { kind: 'rect', x: cx - r, y: cy - r * 0.32, w: r * 2, h: r * 0.64, fill, part };
		case 'diamond':
			return {
				kind: 'polygon',
				points: polygonPoints([
					[cx, cy - r],
					[cx + r, cy],
					[cx, cy + r],
					[cx - r, cy],
				]),
				fill,
				stroke,
				strokeWidth: 0,
				part,
			};
		case 'triangle':
			return {
				kind: 'polygon',
				points: polygonPoints([
					[cx, cy - r],
					[cx + r * 0.9, cy + r * 0.75],
					[cx - r * 0.9, cy + r * 0.75],
				]),
				fill,
				stroke,
				strokeWidth: 0,
				part,
			};
		case 'star':
			return {
				kind: 'polygon',
				points: polygonPoints(starVertices(cx, cy, r)),
				fill,
				stroke,
				strokeWidth: 0,
				part,
			};
		case 'plus':
			return {
				kind: 'path',
				d: `M${(cx - r).toFixed(2)},${cy.toFixed(2)} L${(cx + r).toFixed(2)},${cy.toFixed(2)} M${cx.toFixed(2)},${(cy - r).toFixed(2)} L${cx.toFixed(2)},${(cy + r).toFixed(2)}`,
				fill: 'none',
				stroke,
				strokeWidth: Math.max(1, r * 0.4),
				part,
			};
		case 'x':
			return {
				kind: 'path',
				d: `M${(cx - r).toFixed(2)},${(cy - r).toFixed(2)} L${(cx + r).toFixed(2)},${(cy + r).toFixed(2)} M${(cx + r).toFixed(2)},${(cy - r).toFixed(2)} L${(cx - r).toFixed(2)},${(cy + r).toFixed(2)}`,
				fill: 'none',
				stroke,
				strokeWidth: Math.max(1, r * 0.4),
				part,
			};
		case 'dot':
			return { kind: 'circle', cx, cy, r: Math.max(r * 0.6, 1), fill, part };
		default:
			// circle / auto / picture / undefined -> filled circle.
			return { kind: 'circle', cx, cy, r, fill, part };
	}
}
