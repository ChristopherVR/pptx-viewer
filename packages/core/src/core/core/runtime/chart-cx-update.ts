/**
 * In-place save-side update of an Office 2016+ ChartEx part
 * (`cx:chartSpace`) from an edited `PptxChartData`.
 *
 * The generic per-chart update in `PptxHandlerRuntimeSaveDataSerialization`
 * only understands the 2006 `c:*Chart` containers, so an edited funnel,
 * waterfall, treemap, sunburst, box-and-whisker, histogram or region map
 * used to save with its original values. This module rewrites the pieces the
 * model carries (series names, colours, data labels, categories, values,
 * title, legend) and leaves everything else (layout properties, axes,
 * extension lists, unique ids) untouched so untouched decks round-trip.
 *
 * @module runtime/chart-cx-update
 */

import type { PptxChartData, XmlObject } from '../../types';
import {
	buildChartExData,
	buildChartExLegend,
	buildChartExSeries,
	chartExLayoutId,
} from '../../utils/chart-cx-generator';
import { applyChartTitleToXml } from '../../utils/chart-title-serializer';
import type { GetLocalName } from './chart-cx-update-series';
import {
	applySeriesColor,
	applySeriesDataLabels,
	applySeriesName,
	asArray,
	bindSeriesData,
	child,
	findKey,
	insertBefore,
	nextDataId,
} from './chart-cx-update-series';

function applyLegend(chartRoot: XmlObject, chartData: PptxChartData, getLocalName: GetLocalName) {
	const style = chartData.style;
	if (!style || style.hasLegend === undefined) {
		return;
	}
	const key = findKey(chartRoot, 'legend', getLocalName);
	if (!style.hasLegend) {
		if (key) {
			delete chartRoot[key];
		}
		return;
	}
	const existing = key ? chartRoot[key] : undefined;
	if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
		if (style.legendPosition !== undefined) {
			(existing as XmlObject)['@_pos'] = buildChartExLegend(style.legendPosition)['@_pos'];
		}
		return;
	}
	if (key) {
		delete chartRoot[key];
	}
	const legend = buildChartExLegend(style.legendPosition);
	insertBefore(chartRoot, 'cx:legend', legend, ['extLst'], getLocalName);
}

/**
 * Whether the model asks for a different ChartEx layout than the part
 * carries (its first `cx:series/@layoutId`), i.e. a same-family type change
 * that needs the part regenerated rather than patched.
 */
export function chartExLayoutChanged(
	chartSpace: XmlObject,
	chartData: PptxChartData,
	getLocalName: GetLocalName,
): boolean {
	const region = child(
		child(child(chartSpace, 'chart', getLocalName), 'plotArea', getLocalName),
		'plotAreaRegion',
		getLocalName,
	);
	const seriesKey = region ? findKey(region, 'series', getLocalName) : undefined;
	const first = region && seriesKey ? asArray(region[seriesKey])[0] : undefined;
	const existing = String(first?.['@_layoutId'] ?? '').toLowerCase();
	const series = chartData.series[0];
	if (!existing || !series) {
		return false;
	}
	return chartExLayoutId(chartData, series).toLowerCase() !== existing;
}

/**
 * Rewrite the series, data, title and legend of a parsed `cx:chartSpace`
 * from `chartData`. Returns `false` (leaving the tree untouched) when the
 * part has no `cx:plotAreaRegion` to update.
 */
export function applyChartExUpdate(
	chartSpace: XmlObject,
	chartData: PptxChartData,
	getLocalName: GetLocalName,
): boolean {
	const chartRoot = child(chartSpace, 'chart', getLocalName);
	const plotArea = child(chartRoot, 'plotArea', getLocalName);
	const region = child(plotArea, 'plotAreaRegion', getLocalName);
	if (!chartRoot || !region) {
		return false;
	}

	const chartDataKey = findKey(chartSpace, 'chartData', getLocalName);
	const chartDataNode =
		(chartDataKey ? (chartSpace[chartDataKey] as XmlObject | undefined) : undefined) ?? {};
	const dataKey = findKey(chartDataNode, 'data', getLocalName) ?? 'cx:data';
	const dataNodes = asArray(chartDataNode[dataKey]);

	const seriesKey = findKey(region, 'series', getLocalName) ?? 'cx:series';
	const existing = asArray(region[seriesKey]);
	const updated: XmlObject[] = [];
	chartData.series.forEach((series, index) => {
		const node = existing[index];
		if (!node) {
			const id = nextDataId(dataNodes);
			dataNodes.push(buildChartExData(chartData, series, id));
			updated.push(buildChartExSeries(chartData, series, id));
			return;
		}
		if (series.name !== undefined) {
			applySeriesName(node, series.name, getLocalName);
		}
		applySeriesColor(node, series, getLocalName);
		applySeriesDataLabels(node, chartData.style?.hasDataLabels, getLocalName);
		bindSeriesData(node, dataNodes, chartData, series, getLocalName);
		updated.push(node);
	});

	// Drop data entries that only removed series referenced.
	const referencedId = (node: XmlObject) => String(child(node, 'dataId', getLocalName)?.['@_val']);
	const liveIds = new Set(updated.map(referencedId));
	const removedIds = new Set(existing.slice(chartData.series.length).map(referencedId));
	const survivingData = dataNodes.filter((data) => {
		const id = String(data['@_id']);
		return liveIds.has(id) || !removedIds.has(id);
	});

	region[seriesKey] = updated.length === 1 ? updated[0] : updated;
	chartDataNode[dataKey] = survivingData.length === 1 ? survivingData[0] : survivingData;
	if (!chartDataKey) {
		insertBefore(chartSpace, 'cx:chartData', chartDataNode, ['chart'], getLocalName);
	}

	applyChartTitleToXml(
		chartRoot,
		{ title: chartData.title, hasTitle: chartData.style?.hasTitle },
		getLocalName,
		{ prefix: 'cx' },
	);
	applyLegend(chartRoot, chartData, getLocalName);
	return true;
}
