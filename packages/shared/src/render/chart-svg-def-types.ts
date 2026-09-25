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

/** One `<stop>` of a gradient def (`offset` 0..1). */
export interface ChartSvgGradientStop {
	offset: number;
	color: string;
	opacity?: number;
}

/**
 * A chart gradient fill (`c:spPr/a:gradFill`, see `chart-gradient-defs.ts`),
 * in `objectBoundingBox` units: a linear gradient's vector runs x1,y1 to
 * x2,y2; a radial one centres on cx,cy with radius r.
 */
export type ChartSvgGradientDef =
	| {
			kind: 'linearGradient';
			id: string;
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			stops: ChartSvgGradientStop[];
	  }
	| {
			kind: 'radialGradient';
			id: string;
			cx: number;
			cy: number;
			r: number;
			stops: ChartSvgGradientStop[];
	  };

export type ChartSvgDef = ChartSvgPatternDef | ChartSvgGradientDef;
