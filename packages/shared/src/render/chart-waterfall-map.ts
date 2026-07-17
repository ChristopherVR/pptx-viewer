/**
 * View-model builders for waterfall and regionMap chart kinds.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-waterfall-combo.tsx  (waterfall only)
 *   packages/react/src/viewer/utils/chart-map.tsx               (regionMap)
 *
 * Produces a `ChartViewModel` (SVG primitives only, zero Angular dependencies)
 * that the Angular ChartRendererComponent template iterates over.
 *
 * Waterfall – running-total bars with positive/negative/total colouring and
 *             dashed connector lines between bars.
 * RegionMap  – choropleth SVG with simplified world region outlines coloured by
 *              the first data series; unmatched regions fall back to a table.
 *
 * @module chart-waterfall-map
 */

import type { PptxChartData, PptxChartRegionMapOptions, PptxElement } from 'pptx-viewer-core';

import {
	buildRegionMapEntries,
	formatRegionMapValue,
	shouldRenderRegionLabel,
} from './chart-region-map-data';
import type { ChartViewModel, SvgLine, SvgPath, SvgRect, SvgText } from './chart-view-model';
import {
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	buildCategoryLabels,
	computePlotLayout,
	formatAxisValue,
	valueToY,
} from './chart-view-model';
import { buildWaterfallSteps, computeWaterfallRange } from './chart-waterfall-layout';

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall colours (mirrors React renderWaterfallChart)
// ─────────────────────────────────────────────────────────────────────────────

const WF_COLOR_POSITIVE = '#22c55e';
const WF_COLOR_NEGATIVE = '#ef4444';
const WF_COLOR_TOTAL = '#6366f1';
const WF_CONNECTOR_COLOR = '#94a3b8';

// ─────────────────────────────────────────────────────────────────────────────
// Public: buildWaterfallViewModel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the view-model for a waterfall chart.
 *
 * Each bar starts from the running total of all previous values; the last bar
 * shows the grand total (reset to 0 base).  Positive values get a green fill,
 * negative values get a red fill, and the final total bar uses indigo.
 * Dashed connector lines join adjacent bar tops/bottoms.
 *
 * Mirrors `renderWaterfallChart` in React's `chart-waterfall-combo.tsx`.
 */
export function buildWaterfallViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const series = chartData.series[0];
	const values = series?.values ?? [];
	const steps = buildWaterfallSteps(values, series?.waterfallOptions);
	const range = computeWaterfallRange(steps);
	const catCount = Math.max(categoryLabels.length, values.length, 1);

	const barWidth = (layout.plotWidth / catCount) * 0.6;
	const gap = (layout.plotWidth / catCount) * 0.2;

	const primitives: Array<SvgRect | SvgLine> = [];
	const dataLabels: SvgText[] = [];

	for (const step of steps) {
		const { sourceIndex, value, startValue, endValue, isSubtotal } = step;
		const barStartY = valueToY(startValue, range, layout.plotTop, layout.plotBottom);
		const barEndY = valueToY(endValue, range, layout.plotTop, layout.plotBottom);
		const i = sourceIndex;
		const x = layout.plotLeft + (layout.plotWidth / catCount) * i + gap;
		const y = Math.min(barStartY, barEndY);
		const h = Math.max(Math.abs(barEndY - barStartY), 1);
		const barColor = isSubtotal
			? WF_COLOR_TOTAL
			: value >= 0
				? WF_COLOR_POSITIVE
				: WF_COLOR_NEGATIVE;

		primitives.push({
			kind: 'rect',
			x,
			y,
			w: barWidth,
			h,
			fill: barColor,
			rx: 1,
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: sourceIndex },
		} satisfies SvgRect);

		if (chartData.style?.hasDataLabels) {
			dataLabels.push({
				kind: 'text',
				x: x + barWidth / 2,
				y: y - 4,
				text: formatAxisValue(value),
				fontSize: 7,
				fill: '#334155',
				textAnchor: 'middle',
			} satisfies SvgText);
		}

		// Connector line to the next bar (not drawn after the last bar).
		if (series?.waterfallOptions?.connectorLines !== false && i < values.length - 1) {
			const nextX = layout.plotLeft + (layout.plotWidth / catCount) * (i + 1) + gap;
			primitives.push({
				kind: 'line',
				x1: x + barWidth,
				y1: barEndY,
				x2: nextX,
				y2: barEndY,
				stroke: WF_CONNECTOR_COLOR,
				strokeWidth: 0.8,
				dashArray: '3 2',
			} satisfies SvgLine);
		}
	}

	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const zeroLine = buildZeroLine(range, layout);
	const catLabels = buildCategoryLabels(categoryLabels, layout, 'bar');

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: catLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// RegionMap: region alias lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping from common category label strings (country names, ISO codes) to
 * internal region keys.  Case-insensitive lookup.
 * Mirrors `REGION_ALIAS_MAP` from React's `chart-map.tsx`.
 */
const REGION_ALIAS_MAP: Record<string, string> = {
	us: 'US',
	usa: 'US',
	'united states': 'US',
	'united states of america': 'US',
	ca: 'CA',
	can: 'CA',
	canada: 'CA',
	br: 'BR',
	bra: 'BR',
	brazil: 'BR',
	gb: 'GB',
	gbr: 'GB',
	uk: 'GB',
	'united kingdom': 'GB',
	fr: 'FR',
	fra: 'FR',
	france: 'FR',
	de: 'DE',
	deu: 'DE',
	germany: 'DE',
	it: 'IT',
	ita: 'IT',
	italy: 'IT',
	es: 'ES',
	esp: 'ES',
	spain: 'ES',
	ru: 'RU',
	rus: 'RU',
	russia: 'RU',
	cn: 'CN',
	chn: 'CN',
	china: 'CN',
	in: 'IN',
	ind: 'IN',
	india: 'IN',
	jp: 'JP',
	jpn: 'JP',
	japan: 'JP',
	kr: 'KR',
	kor: 'KR',
	'south korea': 'KR',
	korea: 'KR',
	au: 'AU',
	aus: 'AU',
	australia: 'AU',
	mx: 'MX',
	mex: 'MX',
	mexico: 'MX',
	id: 'ID',
	idn: 'ID',
	indonesia: 'ID',
	tr: 'TR',
	tur: 'TR',
	turkey: 'TR',
	sa: 'SA',
	sau: 'SA',
	'saudi arabia': 'SA',
	za: 'ZA',
	zaf: 'ZA',
	'south africa': 'ZA',
	ar: 'AR',
	arg: 'AR',
	argentina: 'AR',
	ng: 'NG',
	nga: 'NG',
	nigeria: 'NG',
	eg: 'EG',
	egy: 'EG',
	egypt: 'EG',
};

/** Resolve a category label to a region key (case-insensitive). */
export function resolveRegionCode(label: string): string | undefined {
	const normalized = label.trim().toLowerCase();
	return REGION_ALIAS_MAP[normalized];
}

// ─────────────────────────────────────────────────────────────────────────────
// RegionMap: colour scale helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Interpolate between two hex colours by ratio t in [0..1]. */
function lerpColor(a: string, b: string, t: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	const ha = a.replace('#', '');
	const hb = b.replace('#', '');
	const r1 = parseInt(ha.substring(0, 2), 16);
	const g1 = parseInt(ha.substring(2, 4), 16);
	const b1 = parseInt(ha.substring(4, 6), 16);
	const r2 = parseInt(hb.substring(0, 2), 16);
	const g2 = parseInt(hb.substring(2, 4), 16);
	const b2 = parseInt(hb.substring(4, 6), 16);
	const r = clamp(r1 + (r2 - r1) * t);
	const g = clamp(g1 + (g2 - g1) * t);
	const bl = clamp(b1 + (b2 - b1) * t);
	const toHex = (n: number) => n.toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/**
 * 3-stop sequential colour scale: light (#dbeafe) → mid (#3b82f6) → dark (#1e3a5f).
 * Mirrors `sequentialColorScale` in React's `chart-map.tsx`.
 */
export function sequentialColorScale(t: number): string {
	const clamped = Math.max(0, Math.min(1, t));
	if (clamped <= 0.5) {
		return lerpColor('#dbeafe', '#3b82f6', clamped * 2);
	}
	return lerpColor('#3b82f6', '#1e3a5f', (clamped - 0.5) * 2);
}

/** Normalise a value to [0..1] within a min/max range. */
export function normalizeValue(value: number, min: number, max: number): number {
	if (max === min) {
		return 0.5;
	}
	return (value - min) / (max - min);
}

// ─────────────────────────────────────────────────────────────────────────────
// RegionMap: simplified world region outlines (1000 x 500 viewBox)
// ─────────────────────────────────────────────────────────────────────────────

interface RegionDef {
	code: string;
	name: string;
	/** SVG path d attribute (simplified outline on a 1000 x 500 coordinate system). */
	path: string;
	/** Label anchor [x, y] in the 1000 x 500 space. */
	labelXY: [number, number];
}

/** Simplified world region outlines (mirrors `WORLD_REGIONS` in React's chart-map.tsx). */
const WORLD_REGIONS: RegionDef[] = [
	{
		code: 'US',
		name: 'United States',
		path: 'M130,160 L250,155 265,170 270,190 260,210 230,215 200,220 170,215 145,205 130,195Z M280,175 L295,165 310,170 310,185 295,195 280,190Z',
		labelXY: [200, 190],
	},
	{
		code: 'CA',
		name: 'Canada',
		path: 'M120,90 L280,85 290,100 295,130 280,150 250,155 200,155 160,155 130,155 115,140 110,115Z',
		labelXY: [200, 125],
	},
	{
		code: 'MX',
		name: 'Mexico',
		path: 'M145,215 L200,220 210,235 200,255 185,265 165,260 150,245 140,230Z',
		labelXY: [175, 240],
	},
	{
		code: 'BR',
		name: 'Brazil',
		path: 'M270,300 L310,280 335,290 340,320 330,355 310,370 285,365 265,345 260,320Z',
		labelXY: [300, 330],
	},
	{
		code: 'AR',
		name: 'Argentina',
		path: 'M260,370 L280,365 290,380 285,410 275,435 260,445 250,425 248,395Z',
		labelXY: [268, 410],
	},
	{
		code: 'GB',
		name: 'United Kingdom',
		path: 'M440,120 L448,110 455,115 455,135 448,142 440,138Z',
		labelXY: [448, 128],
	},
	{
		code: 'FR',
		name: 'France',
		path: 'M450,145 L470,140 480,150 478,168 465,175 450,170 445,158Z',
		labelXY: [463, 158],
	},
	{
		code: 'DE',
		name: 'Germany',
		path: 'M478,125 L498,120 505,130 502,148 490,152 478,148 475,138Z',
		labelXY: [490, 138],
	},
	{
		code: 'IT',
		name: 'Italy',
		path: 'M490,155 L498,152 505,162 500,180 492,190 488,178 486,165Z',
		labelXY: [495, 172],
	},
	{
		code: 'ES',
		name: 'Spain',
		path: 'M432,168 L460,165 465,175 460,188 442,192 430,185 428,175Z',
		labelXY: [448, 180],
	},
	{
		code: 'RU',
		name: 'Russia',
		path: 'M510,60 L780,50 830,70 840,100 820,120 750,115 700,105 650,100 580,105 530,110 510,100 505,80Z',
		labelXY: [670, 85],
	},
	{
		code: 'TR',
		name: 'Turkey',
		path: 'M530,165 L570,160 585,170 580,182 555,185 530,180Z',
		labelXY: [558, 175],
	},
	{
		code: 'EG',
		name: 'Egypt',
		path: 'M530,200 L555,195 565,205 560,225 545,230 530,222Z',
		labelXY: [548, 215],
	},
	{
		code: 'NG',
		name: 'Nigeria',
		path: 'M475,275 L500,270 510,280 505,298 490,302 475,295Z',
		labelXY: [492, 288],
	},
	{
		code: 'ZA',
		name: 'South Africa',
		path: 'M520,380 L545,370 560,380 555,400 540,410 520,405 515,392Z',
		labelXY: [538, 392],
	},
	{
		code: 'SA',
		name: 'Saudi Arabia',
		path: 'M565,220 L600,210 615,225 610,250 590,258 570,250 560,238Z',
		labelXY: [590, 238],
	},
	{
		code: 'IN',
		name: 'India',
		path: 'M640,210 L665,195 685,210 688,240 678,268 660,278 645,265 635,240Z',
		labelXY: [662, 240],
	},
	{
		code: 'CN',
		name: 'China',
		path: 'M700,120 L775,115 800,130 805,160 790,180 760,185 730,180 710,168 695,150 690,135Z',
		labelXY: [750, 155],
	},
	{
		code: 'JP',
		name: 'Japan',
		path: 'M835,145 L845,135 852,140 850,158 842,165 835,160Z',
		labelXY: [843, 152],
	},
	{
		code: 'KR',
		name: 'South Korea',
		path: 'M815,158 L825,152 830,160 827,170 818,172 813,165Z',
		labelXY: [822, 163],
	},
	{
		code: 'ID',
		name: 'Indonesia',
		path: 'M740,295 L780,288 810,292 830,298 825,310 790,312 755,308 740,305Z',
		labelXY: [785, 302],
	},
	{
		code: 'AU',
		name: 'Australia',
		path: 'M790,350 L850,340 880,355 885,385 870,405 840,410 810,400 790,380Z',
		labelXY: [838, 378],
	},
];

interface RegionBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

function regionBounds(region: RegionDef): RegionBounds {
	const coordinates = region.path.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
	const xs: number[] = [];
	const ys: number[] = [];
	for (let index = 0; index < coordinates.length; index += 2) {
		xs.push(coordinates[index] ?? 0);
		ys.push(coordinates[index + 1] ?? 0);
	}
	return {
		minX: Math.min(...xs),
		minY: Math.min(...ys),
		maxX: Math.max(...xs),
		maxY: Math.max(...ys),
	};
}

function regionViewBounds(
	viewedRegionType: PptxChartRegionMapOptions['viewedRegionType'],
	regionValues: ReadonlyMap<string, unknown>,
): RegionBounds {
	if (!viewedRegionType || viewedRegionType === 'world' || regionValues.size === 0) {
		return { minX: 0, minY: 0, maxX: 1000, maxY: 500 };
	}
	const matched = WORLD_REGIONS.filter((region) => regionValues.has(region.code));
	const targets = viewedRegionType === 'countryRegion' ? matched.slice(0, 1) : matched;
	if (targets.length === 0) {
		return { minX: 0, minY: 0, maxX: 1000, maxY: 500 };
	}
	const bounds = targets.map(regionBounds);
	const padding = 10;
	return {
		minX: Math.max(0, Math.min(...bounds.map((item) => item.minX)) - padding),
		minY: Math.max(0, Math.min(...bounds.map((item) => item.minY)) - padding),
		maxX: Math.min(1000, Math.max(...bounds.map((item) => item.maxX)) + padding),
		maxY: Math.min(500, Math.max(...bounds.map((item) => item.maxY)) + padding),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: buildRegionMapViewModel
// ─────────────────────────────────────────────────────────────────────────────

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
	const svgWidth = Math.max(element.width, 320);
	const svgHeight = Math.max(element.height, 200);

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

	// Build region → value lookup.
	const regionValueMap = new Map<string, { value: number; label: string; sourceIndex: number }>();
	const unmatchedRows: Array<{ label: string; value: number }> = [];

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
	const fallbackRowH = 14;
	const maxFallbackRows = Math.min(unmatchedRows.length, 5);
	const fallbackTableH = unmatchedRows.length > 0 ? (maxFallbackRows + 1) * fallbackRowH + 8 : 0;
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
			fill = sequentialColorScale(t);
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

	// Colour legend bar (rendered as gradient approximation: three rect stops).
	const legendY = mapOffsetY + mapAreaH + 4;
	const barW = Math.min(svgWidth * 0.4, 160);
	const barX = (svgWidth - barW) / 2;

	// Approximate the gradient using three colour stops as adjacent rects.
	const gradStops = [
		{ offset: 0, color: '#dbeafe' },
		{ offset: 0.5, color: '#3b82f6' },
		{ offset: 1, color: '#1e3a5f' },
	];
	const stopCount = gradStops.length - 1;
	for (let si = 0; si < stopCount; si++) {
		const stopA = gradStops[si];
		const stopB = gradStops[si + 1];
		if (stopA === undefined || stopB === undefined) {
			continue;
		}
		// Use the midpoint colour of each segment.
		const midColor = lerpColor(stopA.color, stopB.color, 0.5);
		primitives.push({
			kind: 'rect',
			x: barX + stopA.offset * barW,
			y: legendY,
			w: (stopB.offset - stopA.offset) * barW,
			h: 8,
			fill: midColor,
			rx: si === 0 ? 4 : 0,
		} satisfies SvgRect);
	}

	// Legend min/max labels.
	primitives.push(
		{
			kind: 'text',
			x: barX,
			y: legendY + 18,
			text: formatAxisValue(minVal),
			fontSize: 7,
			fill: '#64748b',
			textAnchor: 'middle',
		} satisfies SvgText,
		{
			kind: 'text',
			x: barX + barW,
			y: legendY + 18,
			text: formatAxisValue(maxVal),
			fontSize: 7,
			fill: '#64748b',
			textAnchor: 'middle',
		} satisfies SvgText,
	);

	if (options?.attribution) {
		primitives.push({
			kind: 'text',
			x: svgWidth - 4,
			y: svgHeight - 4,
			text: options.attribution,
			fontSize: 5,
			fill: '#64748b',
			textAnchor: 'end',
		} satisfies SvgText);
	}

	// Fallback table for unmatched regions.
	if (unmatchedRows.length > 0) {
		const tableY = legendY + 26;
		const fontSize = Math.min(8, fallbackRowH * 0.7);
		const colW = Math.min((svgWidth - 20) / 2, 120);
		const tableX = (svgWidth - colW * 2) / 2;

		primitives.push({
			kind: 'text',
			x: svgWidth / 2,
			y: tableY,
			text: 'Additional regions (not shown on map)',
			fontSize: 7,
			fill: '#94a3b8',
			textAnchor: 'middle',
		} satisfies SvgText);

		for (let i = 0; i < maxFallbackRows; i++) {
			const row = unmatchedRows[i];
			if (row === undefined) {
				continue;
			}
			const ry = tableY + fallbackRowH * (i + 1);
			if (ry + fallbackRowH > svgHeight) {
				break;
			}

			if (i % 2 === 0) {
				primitives.push({
					kind: 'rect',
					x: tableX,
					y: ry - fallbackRowH + 4,
					w: colW * 2,
					h: fallbackRowH,
					fill: '#f1f5f9',
					rx: 2,
				} satisfies SvgRect);
			}

			primitives.push(
				{
					kind: 'text',
					x: tableX + 4,
					y: ry,
					text: row.label,
					fontSize,
					fill: '#334155',
					textAnchor: 'start',
				} satisfies SvgText,
				{
					kind: 'text',
					x: tableX + colW + 4,
					y: ry,
					text: formatAxisValue(row.value),
					fontSize,
					fill: '#475569',
					textAnchor: 'start',
				} satisfies SvgText,
			);
		}

		if (unmatchedRows.length > 5) {
			const moreY = tableY + fallbackRowH * 6;
			primitives.push({
				kind: 'text',
				x: svgWidth / 2,
				y: moreY,
				text: `+${unmatchedRows.length - 5} more regions`,
				fontSize: 6,
				fill: '#94a3b8',
				textAnchor: 'middle',
			} satisfies SvgText);
		}
	}

	const dataLabels: SvgText[] = titlePrimitive !== undefined ? [titlePrimitive] : [];

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
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: scale a simplified SVG path d string
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-scale and translate each coordinate pair in a simple SVG path `d`
 * attribute (M/L/Z commands only, space/comma delimited).
 *
 * This avoids needing a `transform` attribute on `SvgPath` which doesn't exist
 * in the existing primitive schema.
 */
function scalePathD(d: string, scale: number, dx: number, dy: number): string {
	// Tokenise: split on whitespace, commas, and command letters while keeping
	// command letters in the output.
	const tokens = d.trim().split(/[\s,]+/u);
	const out: string[] = [];
	let i = 0;
	while (i < tokens.length) {
		const tok = tokens[i];
		if (tok === undefined) {
			i++;
			continue;
		}
		// Command letter (M, L, Z, etc.)
		if (/^[A-Za-z]$/u.test(tok)) {
			out.push(tok);
			i++;
			continue;
		}
		// Coordinate pair: tok = x value, tokens[i+1] = y value.
		const xRaw = parseFloat(tok);
		const yRaw = parseFloat(tokens[i + 1] ?? '0');
		if (!Number.isNaN(xRaw) && !Number.isNaN(yRaw)) {
			out.push(`${(xRaw * scale + dx).toFixed(2)},${(yRaw * scale + dy).toFixed(2)}`);
			i += 2;
		} else {
			out.push(tok);
			i++;
		}
	}
	return out.join(' ');
}
