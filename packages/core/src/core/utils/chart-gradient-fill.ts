/**
 * A chart container's or series' gradient fill (`c:spPr/a:gradFill`), parsed
 * into the render-ready stops the viewer paints.
 *
 * Only the solid-fill branch of `c:spPr` used to be read, so a gradient chart
 * area (every dark "Chart Styles" preset: a radial dk1 65%..85% wash) and
 * gradient series (the bevelled bar styles) rendered flat: the chart area not
 * at all, the bars in plain palette colours (COM-verified charts-com.pptx
 * slide 23, chart style 209).
 *
 * @module chart-gradient-fill
 */
import type { PptxChartGradientFill, PptxChartSeries, XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
}

/** The subset of the colour codec this parser needs. */
export interface ChartGradientCodec {
	extractGradientStops(
		gradFill: XmlObject,
	): Array<{ color: string; position: number; opacity?: number }>;
	extractGradientType(gradFill: XmlObject): 'linear' | 'radial';
	extractGradientAngle(gradFill: XmlObject): number;
	extractGradientFocalPoint(gradFill: XmlObject): { x: number; y: number } | undefined;
}

/**
 * Parse `container/c:spPr/a:gradFill` (or `a:gradFill` directly under the
 * given `spPr` when `container` IS the `spPr`), or `undefined` when there is
 * no gradient or it has fewer than two stops.
 */
export function parseChartGradientFill(
	spPr: XmlObject | undefined,
	lookup: XmlLookupLike,
	codec: ChartGradientCodec,
): PptxChartGradientFill | undefined {
	const gradFill = lookup.getChildByLocalName(spPr, 'gradFill');
	if (!gradFill) {
		return undefined;
	}
	const stops = codec
		.extractGradientStops(gradFill)
		.map(({ color, position, opacity }) =>
			opacity !== undefined && opacity < 1 ? { color, position, opacity } : { color, position },
		);
	if (stops.length < 2) {
		return undefined;
	}
	const type = codec.extractGradientType(gradFill);
	if (type === 'radial') {
		const focalPoint = codec.extractGradientFocalPoint(gradFill);
		return focalPoint ? { type, stops, focalPoint } : { type, stops };
	}
	return { type, stops, angle: codec.extractGradientAngle(gradFill) };
}

/** A series' gradient fill, spread onto the parsed series (see `PptxChartSeries.gradientFill`). */
export function seriesGradientFill(
	spPr: XmlObject | undefined,
	lookup: XmlLookupLike,
	codec: ChartGradientCodec,
): Pick<PptxChartSeries, 'gradientFill'> {
	const gradientFill = parseChartGradientFill(spPr, lookup, codec);
	return gradientFill ? { gradientFill } : {};
}
