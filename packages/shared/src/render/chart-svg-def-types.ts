/**
 * chart-svg-def-types.ts: `<defs>` descriptor types for the chart engine,
 * split out of `chart-view-model-types.ts` to keep it within the repo's
 * ~300-LOC limit.
 *
 * @module chart-svg-def-types
 */

/**
 * A `<defs>` entry a chart needs rendered before its primitives, so a
 * primitive's `fill`/`stroke` can reference it by `url(#id)`. Currently only
 * `<pattern>` (a data point's `c:dPt/c:pictureOptions` picture fill, see
 * `chart-datapoint-picture-fills.ts`); the `kind` discriminant leaves room for
 * a future def type without a breaking change to `ChartViewModel.defs`.
 */
export interface ChartSvgPatternDef {
	kind: 'pattern';
	/** Also the `fill="url(#...)"` target on the primitive(s) it paints. Unique per chart instance. */
	id: string;
	/** Image source (a `data:`/`blob:` URL). */
	href: string;
	patternUnits: 'userSpaceOnUse';
	x: number;
	y: number;
	width: number;
	height: number;
	preserveAspectRatio?: string;
}

export type ChartSvgDef = ChartSvgPatternDef;
