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

/** Minimal shape props subset needed to resolve a point fill. */
interface PointShapeProps {
	fillColor?: string;
}

/** Minimal data-point shape consumed here (mirrors `PptxChartDataPoint`). */
export interface ChartDataPointLike {
	idx: number;
	spPr?: PointShapeProps;
	explosion?: number;
}

/** Minimal series shape consumed here (mirrors `PptxChartSeries`). */
export interface ChartSeriesLike {
	color?: string;
	dataPoints?: ChartDataPointLike[];
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
