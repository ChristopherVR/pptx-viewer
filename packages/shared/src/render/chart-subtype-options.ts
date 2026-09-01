/**
 * Inspector option lists + pure patch builders for the three OOXML chart
 * subtype flags parsed/serialized in this wave: bar3D column/bar shape
 * (`c:bar3DChart/c:shape`), radar chart style (`c:radarChart/c:radarStyle`),
 * and surface wireframe (`c:surfaceChart|surface3DChart/c:wireframe`).
 *
 * Each `*_OPTIONS` list is `{ value, labelKey }` for a picker control, in the
 * order PowerPoint itself lists them; each `*Patch` function is a pure
 * decision function returning the minimal `Partial<PptxChartData>` patch an
 * inspector commits back onto the loaded chart data, following this repo's
 * "shared decides, binding only maps" shape (CLAUDE.md Rule 2: a shared
 * decision function, five thin bindings). No binding-specific code lives
 * here; a binding only renders `*_OPTIONS` as a picker and calls the matching
 * patch function on selection.
 *
 * @module chart-subtype-options
 */

import type { PptxBar3DShape, PptxChartData } from 'pptx-viewer-core';

/** One inspector picker entry: the OOXML value plus its i18n label key. */
export interface ChartSubtypeOption<T extends string> {
	value: T;
	labelKey: string;
}

/**
 * `c:bar3DChart/c:shape` picker entries, bar3D charts only. `cone`/`pyramid`
 * are PowerPoint's "Partial Cone/Pyramid" (each bar its own full point);
 * `coneToMax`/`pyramidToMax` are "Full Cone/Pyramid" (one shared apex at the
 * value-axis maximum, so most bars render as a truncated slice).
 */
export const BAR3D_SHAPE_OPTIONS: ReadonlyArray<ChartSubtypeOption<PptxBar3DShape>> = [
	{ value: 'box', labelKey: 'pptx.chart.bar3DShapeBox' },
	{ value: 'cylinder', labelKey: 'pptx.chart.bar3DShapeCylinder' },
	{ value: 'pyramidToMax', labelKey: 'pptx.chart.bar3DShapeFullPyramid' },
	{ value: 'pyramid', labelKey: 'pptx.chart.bar3DShapePartialPyramid' },
	{ value: 'coneToMax', labelKey: 'pptx.chart.bar3DShapeFullCone' },
	{ value: 'cone', labelKey: 'pptx.chart.bar3DShapePartialCone' },
];

/** `c:radarChart/c:radarStyle` picker entries, radar charts only. */
export const RADAR_STYLE_OPTIONS: ReadonlyArray<
	ChartSubtypeOption<NonNullable<PptxChartData['radarStyle']>>
> = [
	{ value: 'standard', labelKey: 'pptx.chart.radarStyleStandard' },
	{ value: 'marker', labelKey: 'pptx.chart.radarStyleMarker' },
	{ value: 'filled', labelKey: 'pptx.chart.radarStyleFilled' },
];

/** `c:surfaceChart|surface3DChart/c:wireframe` toggle entries, surface charts only. */
export const SURFACE_WIREFRAME_OPTIONS: ReadonlyArray<ChartSubtypeOption<'true' | 'false'>> = [
	{ value: 'true', labelKey: 'pptx.chart.wireframeOn' },
	{ value: 'false', labelKey: 'pptx.chart.wireframeOff' },
];

/**
 * Patch to set the chart-level bar3D shape. Returns an empty patch when
 * `chartData.chartType` is not `bar3D`, since `c:shape` has no meaning on a
 * plain (2-D) bar chart.
 */
export function bar3DShapePatch(
	chartData: PptxChartData,
	shape: PptxBar3DShape,
): Partial<PptxChartData> {
	return chartData.chartType === 'bar3D' ? { barShape: shape } : {};
}

/**
 * Patch to set the radar chart style. Returns an empty patch when
 * `chartData.chartType` is not `radar`.
 */
export function radarStylePatch(
	chartData: PptxChartData,
	radarStyle: NonNullable<PptxChartData['radarStyle']>,
): Partial<PptxChartData> {
	return chartData.chartType === 'radar' ? { radarStyle } : {};
}

/**
 * Patch to set the surface wireframe flag. Returns an empty patch when
 * `chartData.chartType` is not `surface` (covers both `c:surfaceChart` and
 * `c:surface3DChart`, both modeled as chart type `"surface"`).
 */
export function surfaceWireframePatch(
	chartData: PptxChartData,
	wireframe: boolean,
): Partial<PptxChartData> {
	return chartData.chartType === 'surface' ? { wireframe } : {};
}
