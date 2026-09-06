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
	/**
	 * Series-level picture-fill flags (`c:ser/c:pictureOptions`): paints every
	 * point in the series with one picture unless a `c:dPt` resolves its own
	 * (see {@link resolveActiveDataPointPicture}).
	 */
	picture?: PptxChartDataPointPicture;
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
 * Resolve the picture-fill flags actually in effect for a point: its OWN
 * `c:dPt/c:pictureOptions` when it resolved an image, otherwise the series'
 * `c:ser/c:pictureOptions` (C2-G9 series-level half). A point with its own
 * picture wins OUTRIGHT (not merged field-by-field with the series' flags),
 * matching how a `c:dPt/c:spPr` fully replaces the series' formatting
 * elsewhere in this resolver ({@link resolveDataPointFill}).
 */
export function resolveActiveDataPointPicture(
	series: ChartSeriesLike,
	pointIndex: number,
): PptxChartDataPointPicture | undefined {
	const pointPicture = findDataPoint(series, pointIndex)?.picture;
	if (pointPicture?.imageUrl) {
		return pointPicture;
	}
	return series.picture?.imageUrl ? series.picture : undefined;
}

/** Which face of a 3-D bar/column a picture fill targets. */
export type BarPictureFace = 'front' | 'side' | 'end';

/** Whether a picture fill paints each of a 3-D bar's three faces. */
export interface BarFaceTargets {
	front: boolean;
	side: boolean;
	end: boolean;
}

/**
 * Resolve which 3-D bar/column faces a picture fill paints
 * (`c:applyToFront`/`c:applyToSides`/`c:applyToEnd`).
 *
 * COM-verified ground truth (PowerPoint Object 16, `c:dPt/c:pictureOptions`
 * with an embedded picture): a `c:pictureOptions` that sets NONE of the three
 * `applyTo*` flags renders IDENTICALLY to one that sets all three to `1` (the
 * picture paints every face). Once at least one flag is present, PowerPoint
 * treats an omitted sibling as `0` (not targeted) rather than re-applying the
 * all-faces default. `picture` undefined (no picture fill at all) targets no
 * face.
 */
export function resolveBarFaceTargets(
	picture: PptxChartDataPointPicture | undefined,
): BarFaceTargets {
	if (!picture) {
		return { front: false, side: false, end: false };
	}
	const { applyToFront, applyToSides, applyToEnd } = picture;
	if (applyToFront === undefined && applyToSides === undefined && applyToEnd === undefined) {
		return { front: true, side: true, end: true };
	}
	return { front: applyToFront ?? false, side: applyToSides ?? false, end: applyToEnd ?? false };
}

/**
 * Resolve a data point's picture-fill pattern descriptor from
 * {@link resolveActiveDataPointPicture}, or `undefined` when the point (and
 * its series) have no picture fill, the runtime could not resolve the image
 * ({@link PptxChartDataPointPicture.imageUrl} absent), or (when `face` is
 * given) the resolved flags do not target that face
 * ({@link resolveBarFaceTargets}, C2-G9 3-D face-targeting half).
 *
 * `face` is only meaningful for a 3-D bar/column's oblique-projection faces
 * (front rect, side + end/top extrusion polygons); every other picture-filled
 * chart mark (a plain 2-D bar, a pie slice, ...) has exactly one face and
 * calls this without it, preserving the pre-face-targeting behaviour of
 * always painting the picture once resolved.
 */
export function resolveDataPointPictureFill(
	series: ChartSeriesLike,
	pointIndex: number,
	seriesIndex: number,
	face?: BarPictureFace,
): DataPointPictureFill | undefined {
	const picture = resolveActiveDataPointPicture(series, pointIndex);
	if (!picture?.imageUrl) {
		return undefined;
	}
	if (face) {
		const targets = resolveBarFaceTargets(picture);
		const targeted =
			face === 'front' ? targets.front : face === 'side' ? targets.side : targets.end;
		if (!targeted) {
			return undefined;
		}
	}
	const format = picture.pictureFormat ?? DEFAULT_PICTURE_FORMAT;
	return {
		patternId: `chart-dpt-pic-${seriesIndex}-${pointIndex}${face && face !== 'front' ? `-${face}` : ''}`,
		imageUrl: picture.imageUrl,
		format,
		...(format !== 'stretch' && picture.pictureStackUnit !== undefined
			? { tileHeightPx: chartFontPx(picture.pictureStackUnit) }
			: {}),
	};
}
