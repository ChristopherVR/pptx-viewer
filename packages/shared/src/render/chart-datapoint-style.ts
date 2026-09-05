/**
 * chart-datapoint-style.ts: framework-agnostic resolution of per-data-point
 * formatting overrides (`c:dPt`).
 *
 * A chart series may override the appearance of individual data points: a
 * per-point fill colour, or (for pie/doughnut) a slice "explosion" pull-out
 * distance. These helpers resolve the effective value for a given point index,
 * falling back to the series-level default, so every binding (React/Vue/Angular)
 * can render edited per-point formatting identically without re-implementing the
 * lookup.
 *
 * @module chart-datapoint-style
 */

import type { PptxChartDataPointPicture, PptxChartMarkerSymbol } from 'pptx-viewer-core';

import { chartFontPx } from './chart-font';

/** Minimal shape props subset needed to resolve a point fill. */
interface PointShapeProps {
	fillColor?: string;
}

/** Minimal marker shape consumed here (mirrors `PptxChartMarker`). */
export interface ChartMarkerLike {
	symbol?: PptxChartMarkerSymbol;
	size?: number;
	spPr?: PointShapeProps;
}

/** Minimal data-point shape consumed here (mirrors `PptxChartDataPoint`). */
export interface ChartDataPointLike {
	idx: number;
	spPr?: PointShapeProps;
	explosion?: number;
	marker?: ChartMarkerLike;
	picture?: PptxChartDataPointPicture;
}

/** Minimal series shape consumed here (mirrors `PptxChartSeries`). */
export interface ChartSeriesLike {
	color?: string;
	marker?: ChartMarkerLike;
	dataPoints?: ChartDataPointLike[];
}

/** The marker attributes actually drawn for one data point. */
export interface ResolvedPointMarker {
	symbol: PptxChartMarkerSymbol | undefined;
	size: number | undefined;
	/** Marker-specific fill, when the point or series pins one. */
	fill: string | undefined;
}

/** Look up the `c:dPt` override for a point index, if any. */
export function findDataPoint(
	series: ChartSeriesLike,
	pointIndex: number,
): ChartDataPointLike | undefined {
	return series.dataPoints?.find((p) => p.idx === pointIndex);
}

/**
 * Resolve the effective fill colour for a single data point: the per-point
 * `c:dPt` fill when present, otherwise the series colour, otherwise
 * `fallbackColor`. Returns `undefined` only when nothing is set.
 */
export function resolveDataPointFill(
	series: ChartSeriesLike,
	pointIndex: number,
	fallbackColor?: string,
): string | undefined {
	const point = findDataPoint(series, pointIndex);
	return point?.spPr?.fillColor ?? series.color ?? fallbackColor;
}

/**
 * Resolve the fill for a data point in a "vary colours" context, where every
 * point in a single series is drawn with a distinct palette colour (pie /
 * doughnut slices, or a bar/column series with `c:varyColors=1`). A per-point
 * `c:dPt` fill still wins; otherwise the supplied per-point `paletteColor` is
 * used (NOT the single series colour, which would make every point identical).
 */
export function resolveVaryColorFill(
	series: ChartSeriesLike,
	pointIndex: number,
	paletteColor: string,
): string {
	return findDataPoint(series, pointIndex)?.spPr?.fillColor ?? paletteColor;
}

/**
 * Resolve the slice explosion (pull-out distance, 0-100) for a pie/doughnut
 * data point: the per-point `c:dPt` explosion when present, otherwise the
 * series-level explosion, otherwise `0`.
 */
export function resolveDataPointExplosion(
	series: ChartSeriesLike & { explosion?: number },
	pointIndex: number,
): number {
	const point = findDataPoint(series, pointIndex);
	return point?.explosion ?? series.explosion ?? 0;
}

/**
 * Resolve the marker actually drawn for one data point.
 *
 * OOXML lets a `c:dPt` carry its own `c:marker`, which overrides the series
 * `c:ser/c:marker` for that point alone: the classic use is highlighting a
 * single outlier with a bigger star while the rest of the line keeps its small
 * circles. Every field falls back independently, matching PowerPoint: a point
 * marker that sets only `c:symbol` keeps the series size and fill.
 *
 * This exists because the per-point marker was a write-only feature. The core
 * parser read `c:dPt/c:marker`, the save writer round-tripped it, and three
 * bindings shipped an inspector control for it, but the renderer only ever
 * looked at `series.marker`, so editing a point marker changed the file and
 * left the canvas untouched. Resolving it here fixes every binding at once,
 * since they all paint the same shared view model.
 */
export function resolveDataPointMarker(
	series: ChartSeriesLike,
	pointIndex: number,
): ResolvedPointMarker {
	const point = findDataPoint(series, pointIndex)?.marker;
	return {
		symbol: point?.symbol ?? series.marker?.symbol,
		size: point?.size ?? series.marker?.size,
		fill: point?.spPr?.fillColor ?? series.marker?.spPr?.fillColor,
	};
}

/**
 * Insert or replace the `c:dPt` override carrying `point.idx`, returning a NEW
 * array (the input is never mutated).
 *
 * WHY this is shared rather than open-coded per inspector: `c:dPt` entries are
 * SPARSE and unordered. A deck may carry a single override for point 7 and
 * nothing else, so `dataPoints[n] = ...` retargets the edit at whichever point
 * happens to occupy that slot, and `dataPoints[0]` pins every edit to the first
 * override regardless of which point the user picked. The renderer resolves a
 * point through {@link findDataPoint}, which keys on `c:idx`, so any editor that
 * writes by array position disagrees with what gets painted. Keeping the write
 * next to the lookup it has to agree with is what stops the two drifting.
 */
export function upsertDataPoint<P extends ChartDataPointLike>(
	dataPoints: readonly P[] | undefined,
	point: P,
): P[] {
	const next = [...(dataPoints ?? [])];
	const position = next.findIndex((candidate) => candidate.idx === point.idx);
	if (position >= 0) {
		next[position] = point;
	} else {
		next.push(point);
	}
	return next;
}

/**
 * An SVG `<pattern>` a binding must render into its chart's `<defs>` to paint
 * a data point's picture fill (`c:dPt/c:pictureOptions`, C2-G9 render half).
 * Pure decision function (CLAUDE.md Rule 2): every field a binding needs to
 * build the pattern element and point the rect's `fill` at it, with no
 * chart-type-specific logic left for the binding to reimplement.
 */
export interface DataPointPictureFill {
	/** Unique id for this point's `<pattern>` element; also its `fill="url(#...)"` target. */
	patternId: string;
	imageUrl: string;
	/** `stretch` fills the whole rect with one scaled copy; `stack`/`stackScale` tile it. */
	format: NonNullable<PptxChartDataPointPicture['pictureFormat']>;
	/**
	 * Height (px) of one repeated tile for `stack`/`stackScale`
	 * (`c:pictureStackUnit`, converted from points). `undefined` for `stretch`,
	 * where the image covers the whole rect and stacking is meaningless.
	 */
	tileHeightPx?: number;
}

/** PowerPoint's own default picture-fill format when `c:pictureFormat` is absent. */
const DEFAULT_PICTURE_FORMAT: NonNullable<PptxChartDataPointPicture['pictureFormat']> = 'stretch';

/**
 * Resolve a data point's picture-fill pattern descriptor from its
 * {@link ChartDataPointLike.picture}, or `undefined` when the point has no
 * picture fill or the runtime could not resolve its image
 * ({@link PptxChartDataPointPicture.imageUrl} absent).
 */
export function resolveDataPointPictureFill(
	series: ChartSeriesLike,
	pointIndex: number,
	seriesIndex: number,
): DataPointPictureFill | undefined {
	const picture = findDataPoint(series, pointIndex)?.picture;
	if (!picture?.imageUrl) {
		return undefined;
	}
	const format = picture.pictureFormat ?? DEFAULT_PICTURE_FORMAT;
	return {
		patternId: `chart-dpt-pic-${seriesIndex}-${pointIndex}`,
		imageUrl: picture.imageUrl,
		format,
		...(format !== 'stretch' && picture.pictureStackUnit !== undefined
			? { tileHeightPx: chartFontPx(picture.pictureStackUnit) }
			: {}),
	};
}
