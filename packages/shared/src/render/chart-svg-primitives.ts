/**
 * chart-svg-primitives.ts: the SVG primitive descriptor types a chart
 * view-model's `primitives` array is built from (rect / path / polyline /
 * circle / line / polygon / text / areaGradient). Split out of
 * `chart-view-model-types.ts` to keep it within the repo's ~300-LOC limit;
 * `chart-view-model.ts` re-exports everything here.
 *
 * @module chart-svg-primitives
 */
import type { ChartPartRef } from './chart-view-model-types';

/**
 * Hover tooltip / accessible name, projected as each primitive's SVG `<title>`
 * child. Every primitive kind that can represent a data mark (rect, path,
 * polyline, circle, line, polygon) carries this field so any chart mark, not
 * just the region map's choropleth patches, can surface a tooltip. Projectors
 * that ignore the field simply render no tooltip.
 */
export interface SvgRect {
	kind: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
	rx?: number;
	opacity?: number;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgPath {
	kind: 'path';
	d: string;
	fill: string;
	stroke?: string;
	strokeWidth?: number;
	opacity?: number;
	part?: ChartPartRef;
	/**
	 * Hover tooltip / accessible name, projected as an SVG `<title>` child.
	 *
	 * The region map (chart-waterfall-map.ts) was the first to set it: a
	 * choropleth patch carries no label of its own, so without a tooltip the
	 * reader cannot tell which region a colour belongs to. Every other primitive
	 * kind now carries the same field for the same reason on the mainstream chart
	 * kinds (bar / line / area / scatter / bubble / pie / radar). Projectors that
	 * ignore the field simply render no tooltip.
	 */
	title?: string;
}

export interface SvgPolyline {
	kind: 'polyline';
	points: string;
	stroke: string;
	strokeWidth: number;
	fill: string;
	opacity?: number;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgCircle {
	kind: 'circle';
	cx: number;
	cy: number;
	r: number;
	fill: string;
	opacity?: number;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgLine {
	kind: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	stroke: string;
	strokeWidth: number;
	dashArray?: string;
	opacity?: number;
	title?: string;
	/** Optional SVG transform (e.g. a chart-overlay connector's own rotation about its box centre). */
	transform?: string;
}

export interface SvgText {
	kind: 'text';
	x: number;
	y: number;
	text: string;
	fontSize: number;
	fill: string;
	textAnchor: 'start' | 'middle' | 'end';
	fontWeight?: 'normal' | 'bold';
	fontFamily?: string;
	/** Italic styling, e.g. from a chart data-table or legend-entry `c:txPr` override. */
	fontStyle?: 'normal' | 'italic';
	dominantBaseline?: string;
	opacity?: number;
	/** Optional SVG transform (e.g. `rotate(-90, x, y)` for a vertical axis title). */
	transform?: string;
}

export interface SvgPolygon {
	kind: 'polygon';
	points: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity?: number;
	dashArray?: string;
	part?: ChartPartRef;
	title?: string;
	/** Optional SVG transform (e.g. a chart-overlay shape's own rotation/flip about its box centre). */
	transform?: string;
}

export interface SvgAreaGradient {
	kind: 'areaGradient';
	id: string;
	color: string;
}

export type SvgPrimitive =
	| SvgRect
	| SvgPath
	| SvgPolyline
	| SvgCircle
	| SvgLine
	| SvgPolygon
	| SvgText
	| SvgAreaGradient;
