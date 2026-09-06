/**
 * View-model builder for the regionMap (choropleth) chart kind.
 *
 * Split out of `chart-waterfall-map.ts` (which re-exports this) to keep that
 * file's two unrelated chart kinds (waterfall, regionMap) each under the
 * repo's per-file line budget.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-map.tsx
 *
 * RegionMap - choropleth SVG with simplified world region outlines coloured by
 *             the first data series; unmatched regions fall back to a table.
 *
 * @module chart-region-map-view
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { regionBounds, regionViewBounds, scalePathD, WORLD_REGIONS } from './chart-map-projection';
import { resolveRegionCode } from './chart-region-map-alias';
import {
	buildRegionMapColorLegend,
	normalizeValue,
	sequentialColorScale,
} from './chart-region-map-colors';
import {
	buildRegionMapEntries,
	buildValueColorScale,
	formatRegionMapValue,
	resolveValueColorStops,
	shouldRenderRegionLabel,
} from './chart-region-map-data';
import {
	buildRegionMapFallbackTable,
	fallbackTableHeight,
} from './chart-region-map-fallback-table';
import type { UnmatchedRegionRow } from './chart-region-map-fallback-table';
import type { ChartValueDrag, ChartViewModel, SvgPath, SvgRect, SvgText } from './chart-view-model';
import { formatAxisValue } from './chart-view-model';

/**
 * Build the view-model for a regionMap (choropleth) chart.
 *
 * Matches category labels against known world regions, colours them by the
 * first series' values using a sequential blue colour scale, and renders a
 * simple colour-legend bar below the map.  Unmatched regions are collected
 * into a small fallback table rendered as SVG text rows.
 *
 * Mirrors `renderMapChart` in React's `chart-map.tsx`.
 */
export function buildRegionMapViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	// Match the element frame exactly; bindings stretch the viewBox with
	// preserveAspectRatio "none", so a minimum would scale non-uniformly.
	const svgWidth = Math.max(element.width, 1);
	const svgHeight = Math.max(element.height, 1);

	const categories = categoryLabels.length > 0 ? categoryLabels : chartData.categories;
	const series = chartData.series[0];
	const options = series?.regionMapOptions;
	const entries = buildRegionMapEntries(
		categories,
		series?.values ?? [],
		options,
		resolveRegionCode,
	);
	const values = entries.map((entry) => entry.value);

	const finiteVals = values.filter((v) => Number.isFinite(v));
	const minVal = finiteVals.length > 0 ? Math.min(...finiteVals) : 0;
	const maxVal = finiteVals.length > 0 ? Math.max(...finiteVals) : 1;
	// cx:valueColors/cx:valueColorPositions: a chart-authored 2-3 stop
	// gradient the region-map colours by value, instead of the fixed
	// blue sequential scale. Falls back to that scale when the chart
	// authors no value-color gradient (the common case).
	const valueColorStops = resolveValueColorStops(
		options?.valueColors,
		options?.valueColorPositions,
		minVal,
		maxVal,
	);
	const colorScale = valueColorStops ? buildValueColorScale(valueColorStops) : sequentialColorScale;

	// Build region -> value lookup.
	const regionValueMap = new Map<string, { value: number; label: string; sourceIndex: number }>();
	const unmatchedRows: UnmatchedRegionRow[] = [];

	for (const entry of entries) {
		if (entry.code !== undefined) {
			regionValueMap.set(entry.code, {
				value: entry.value,
				label: entry.label,
				sourceIndex: entry.sourceIndex,
			});
		} else {
			unmatchedRows.push({ label: entry.label, value: entry.value });
		}
	}

	// Layout measurements.
	const legendHeight = 30;
	const fallbackTableH = fallbackTableHeight(unmatchedRows);
	const titleH = chartData.title ? 22 : 0;
	const mapAreaH = Math.max(svgHeight - titleH - legendHeight - fallbackTableH - 8, 80);

	const viewBounds = regionViewBounds(options?.viewedRegionType, regionValueMap);
	const viewWidth = Math.max(viewBounds.maxX - viewBounds.minX, 1);
	const viewHeight = Math.max(viewBounds.maxY - viewBounds.minY, 1);
	const mapScale = Math.min((svgWidth - 20) / viewWidth, mapAreaH / viewHeight);
	const mapOffsetX = (svgWidth - viewWidth * mapScale) / 2 - viewBounds.minX * mapScale;
	const mapOffsetY = titleH + 4 - viewBounds.minY * mapScale;

	const primitives: Array<SvgPath | SvgRect | SvgText> = [];

	// Background.
	primitives.push({
		kind: 'rect',
		x: 0,
		y: 0,
		w: svgWidth,
		h: svgHeight,
		fill: '#f8fafc',
		rx: 4,
	} satisfies SvgRect);

	// Title text.
	const titlePrimitive: SvgText | undefined = chartData.title
		? {
				kind: 'text',
				x: svgWidth / 2,
				y: 16,
				text: chartData.title,
				fontSize: 12,
				fill: '#334155',
				textAnchor: 'middle',
				fontWeight: 'bold',
				dominantBaseline: 'auto',
			}
		: undefined;

	// Region shape paths.
	for (const region of WORLD_REGIONS) {
		const entry = regionValueMap.get(region.code);
		let fill = '#e2e8f0';

		if (entry !== undefined) {
			const t = normalizeValue(entry.value, minVal, maxVal);
			fill = colorScale(t);
		}

		// Embed the transform in the path's d attribute via a manual coordinate
		// scale+translate since SvgPath has no transform field.  We replicate
		// React's `transform="translate(mapOffsetX,mapOffsetY) scale(mapScale)"`
		// by pre-scaling every coordinate pair in the path string.
		const scaledPath = scalePathD(region.path, mapScale, mapOffsetX, mapOffsetY);

		primitives.push({
			kind: 'path',
			d: scaledPath,
			fill,
			stroke: '#94a3b8',
			strokeWidth: Math.max(0.5 / mapScale, 0.3),
			// Hover tooltip. A choropleth prints only the value inside the shape
			// (and only where the shape is big enough), so without this the reader
			// has no way to find out WHICH country a patch of colour is.
			title: entry ? `${region.name}: ${formatAxisValue(entry.value)}` : region.name,
			...(entry
				? {
						part: {
							role: 'dataPoint' as const,
							seriesIndex: 0,
							pointIndex: entry.sourceIndex,
						},
					}
				: {}),
		} satisfies SvgPath);

		// Inline data label for matched regions.
		const bounds = regionBounds(region);
		if (
			entry !== undefined &&
			shouldRenderRegionLabel(
				options?.regionLabelLayout,
				(bounds.maxX - bounds.minX) * mapScale,
				(bounds.maxY - bounds.minY) * mapScale,
			)
		) {
			const lx = region.labelXY[0] * mapScale + mapOffsetX;
			const ly = region.labelXY[1] * mapScale + mapOffsetY + 4;
			primitives.push({
				kind: 'text',
				x: lx,
				y: ly,
				text: formatRegionMapValue(entry.value, options?.cultureLanguage),
				fontSize: Math.max(6, 7 * mapScale),
				fill: '#1e293b',
				textAnchor: 'middle',
				fontWeight: 'bold',
				dominantBaseline: 'central',
			} satisfies SvgText);
		}
	}

	// Colour legend bar, min/max labels, and optional attribution.
	const legendY = mapOffsetY + mapAreaH + 4;
	primitives.push(
		...buildRegionMapColorLegend({
			svgWidth,
			svgHeight,
			legendY,
			minVal,
			maxVal,
			colorScale,
			attribution: options?.attribution,
		}),
	);

	// Fallback table for unmatched regions.
	primitives.push(...buildRegionMapFallbackTable(unmatchedRows, legendY, svgWidth, svgHeight));

	const dataLabels: SvgText[] = titlePrimitive !== undefined ? [titlePrimitive] : [];

	// A region's value is a plain number driving the colour scale, with no
	// vertical pixel position of its own (unlike a bar/line mark, or even a
	// surface cell's grid row), so there is no "up" a region already visually
	// sits toward. Rather than declare drag meaningless, this reuses the exact
	// generic vertical-drag contract every other kind uses (`chart-canvas-drag.ts`
	// only ever needs a pixel range + `ValueRange`, never an actual mark
	// position): the drag maps top-of-map/bottom-of-map to the current
	// max/min value, matching the legend bar's own gradient direction, so a
	// region dragged to the top of the map reads its value up toward the
	// legend's high end, and to the bottom toward its low end.
	const valueDrag: ChartValueDrag = {
		range: { min: minVal, max: maxVal, span: Math.max(maxVal - minVal, Number.EPSILON) },
		plotTop: mapOffsetY,
		plotBottom: mapOffsetY + mapAreaH,
	};

	return {
		svgWidth,
		svgHeight,
		title: undefined, // Rendered inline as a dataLabel text primitive above.
		titleX: svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives,
		dataLabels,
		legend: [],
		legendX: svgWidth / 2,
		legendY: svgHeight - 8,
		legendAnchor: 'middle',
		valueDrag,
	};
}
