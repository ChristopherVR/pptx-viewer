/**
 * Chart gradient fills (`c:spPr/a:gradFill` on the chart area, plot area and
 * series) as `<linearGradient>` / `<radialGradient>` defs every binding
 * renders from the view model.
 *
 * COM-verified against charts-com.pptx slide 23 (chart style 209): the chart
 * area is a radial dark wash and every bar a top-lit vertical gradient;
 * both used to render flat (no chart area at all, bars in plain palette
 * colours) because only `a:solidFill` was ever read.
 *
 * Gradients use `objectBoundingBox` units, so one def per series paints each
 * of its bars across that bar's own box, as PowerPoint does
 * (`rotWithShape="1"`).
 *
 * @module chart-gradient-defs
 */
import type { PptxChartData, PptxChartGradientFill } from 'pptx-viewer-core';

import type { ChartSvgGradientDef } from './chart-svg-def-types';
import type { ChartViewModel, SvgPrimitive } from './chart-view-model-types';

/** Build the def for `fill` under `id`. */
export function buildGradientDef(id: string, fill: PptxChartGradientFill): ChartSvgGradientDef {
	const stops = fill.stops.map((stop) => ({
		offset: Math.min(Math.max(stop.position / 100, 0), 1),
		color: stop.color,
		...(stop.opacity !== undefined ? { opacity: stop.opacity } : {}),
	}));
	if (fill.type === 'radial') {
		return {
			kind: 'radialGradient',
			id,
			cx: fill.focalPoint?.x ?? 0.5,
			cy: fill.focalPoint?.y ?? 0.5,
			// `a:path path="circle"` reaches the box corners, not its edges.
			r: Math.SQRT1_2,
			stops,
		};
	}
	// `a:lin/@ang` is clockwise from left-to-right; in bounding-box space the
	// vector through the centre at that angle spans the unit box.
	const rad = ((fill.angle ?? 0) * Math.PI) / 180;
	const dx = Math.cos(rad) / 2;
	const dy = Math.sin(rad) / 2;
	const r = (v: number) => Math.round(v * 10000) / 10000;
	return {
		kind: 'linearGradient',
		id,
		x1: r(0.5 - dx),
		y1: r(0.5 - dy),
		x2: r(0.5 + dx),
		y2: r(0.5 + dy),
		stops,
	};
}

function paintSeries(
	primitive: SvgPrimitive,
	seriesFills: ReadonlyMap<number, string>,
	chartData: PptxChartData,
): SvgPrimitive {
	if ((primitive.kind !== 'rect' && primitive.kind !== 'path') || !primitive.part) {
		return primitive;
	}
	const { seriesIndex, pointIndex } = primitive.part;
	const url = seriesFills.get(seriesIndex);
	if (url === undefined) {
		return primitive;
	}
	const overridden =
		pointIndex !== undefined &&
		chartData.series[seriesIndex]?.dataPoints?.some(
			(p) => p.idx === pointIndex && p.spPr?.fillColor !== undefined,
		);
	return overridden ? primitive : { ...primitive, fill: url };
}

/**
 * Point the chart area, plot area and series marks of a finished view model
 * at gradient defs when the chart authors gradient fills.
 */
export function withGradientFills(
	vm: ChartViewModel,
	chartData: PptxChartData,
	elementId: string,
): ChartViewModel {
	const defs: ChartSvgGradientDef[] = [];
	const idFor = (suffix: string) => `${elementId}-grad-${suffix}`.replace(/[^A-Za-z0-9_-]/gu, '_');
	let next = vm;
	const area = chartData.style?.chartAreaGradient;
	if (area) {
		defs.push(buildGradientDef(idFor('area'), area));
		next = { ...next, areaFill: `url(#${idFor('area')})` };
	}
	const plot = chartData.style?.plotAreaGradient;
	if (plot) {
		defs.push(buildGradientDef(idFor('plot'), plot));
		next = { ...next, plotFill: `url(#${idFor('plot')})` };
	}
	const seriesFills = new Map<number, string>();
	chartData.series.forEach((series, si) => {
		if (series.gradientFill) {
			defs.push(buildGradientDef(idFor(`s${si}`), series.gradientFill));
			seriesFills.set(si, `url(#${idFor(`s${si}`)})`);
		}
	});
	if (seriesFills.size > 0) {
		next = {
			...next,
			primitives: next.primitives.map((p) => paintSeries(p, seriesFills, chartData)),
		};
	}
	return defs.length > 0 ? { ...next, defs: [...(next.defs ?? []), ...defs] } : next;
}
