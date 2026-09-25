/**
 * Chart Design > Quick Layout: Layout 1-11, each a set of chart elements
 * switched on or off together (`chart-quick-layout-catalog.ts`, measured via
 * COM on a column chart). A pick toggles the matching `PptxChartData` fields
 * through the same helpers the "Chart Elements" quick action uses; gap width
 * and overlap only apply to bar / column charts. Line and area charts take the
 * same element set (PowerPoint's own line layouts are not separately
 * measured).
 *
 * @module render/ribbon-galleries/chart-quick-layout-gallery
 */
import type {
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartDataTable,
	PptxElement,
} from 'pptx-viewer-core';

import { patchChartData } from '../chart-editor-options';
import { chartGridlinesPatch, chartGridlinesState } from '../chart-gridlines-toggle';
import { chartDataLabelsTogglePatch } from '../chart-quick-action-toggles';
import { chartLayoutTileSvg } from './chart-gallery-tiles';
import type { ChartQuickLayout } from './chart-quick-layout-catalog';
import { CHART_QUICK_LAYOUTS } from './chart-quick-layout-catalog';
import type { RibbonGalleryModule } from './gallery-module';

const TILE = { width: 56, height: 44 };
const AXIS_TITLE = 'Axis Title';
const LAYOUT_CHART_TYPES = new Set(['bar', 'bar3D', 'line', 'line3D', 'area', 'area3D']);

function chartDataOf(element: PptxElement | null): PptxChartData | undefined {
	return element?.type === 'chart' && LAYOUT_CHART_TYPES.has(element.chartData?.chartType ?? '')
		? element.chartData
		: undefined;
}

function isCategoryAxis(axis: PptxChartAxisFormatting): boolean {
	return axis.axisType === 'catAx' || axis.axisType === 'dateAx';
}

function axisTitle(current: string | undefined, show: boolean): string | undefined {
	return show ? current || AXIS_TITLE : undefined;
}

/** `chartData` with Quick Layout `layout` applied. */
export function applyChartQuickLayout(
	chartData: PptxChartData,
	layout: ChartQuickLayout,
): PptxChartData {
	const withGrid = patchChartData(chartData, chartGridlinesPatch(chartData, layout.majorGridlines));
	const axes = (withGrid.axes ?? []).map((axis) => {
		if (axis.axisType === 'valAx') {
			return {
				...axis,
				titleText: axisTitle(axis.titleText, layout.valAxisTitle),
				minorGridlines: layout.minorGridlines,
				deleted: !layout.valueAxis,
			};
		}
		if (isCategoryAxis(axis)) {
			return {
				...axis,
				titleText: axisTitle(axis.titleText, layout.catAxisTitle),
				majorGridlines: false,
				deleted: false,
			};
		}
		return axis;
	});
	const style = {
		...withGrid.style,
		hasTitle: layout.title,
		hasLegend: layout.legend !== null,
		...(layout.legend && { legendPosition: layout.legend }),
		...chartDataLabelsTogglePatch(withGrid.style, layout.dataLabels),
	};
	if (layout.dataLabels) {
		style.dataLabels = { ...style.dataLabels, showValue: true, position: 'outEnd' };
	}
	const dataTable: PptxChartDataTable | null = layout.dataTable
		? {
				...chartData.dataTable,
				showHorzBorder: true,
				showVertBorder: true,
				showOutline: true,
				showKeys: true,
			}
		: null;
	const isBar = chartData.chartType === 'bar' || chartData.chartType === 'bar3D';
	return {
		...withGrid,
		axes,
		style,
		dataTable,
		...(isBar && { barGapWidth: layout.gapWidth, barOverlap: layout.overlap }),
	};
}

/** Whether the chart's element set is exactly `layout`'s. */
function matchesLayout(chartData: PptxChartData, layout: ChartQuickLayout): boolean {
	const style = chartData.style ?? {};
	const axes = chartData.axes ?? [];
	const valAxis = axes.find((axis) => axis.axisType === 'valAx');
	const catAxis = axes.find(isCategoryAxis);
	const legend = style.hasLegend ? (style.legendPosition ?? 'r') : null;
	const isBar = chartData.chartType === 'bar' || chartData.chartType === 'bar3D';
	const barMatches =
		!isBar ||
		((chartData.barGapWidth ?? 150) === layout.gapWidth &&
			(chartData.barOverlap ?? 0) === layout.overlap);
	return (
		barMatches &&
		Boolean(style.hasTitle) === layout.title &&
		legend === layout.legend &&
		Boolean(style.hasDataLabels) === layout.dataLabels &&
		Boolean(chartData.dataTable) === layout.dataTable &&
		Boolean(catAxis?.titleText) === layout.catAxisTitle &&
		Boolean(valAxis?.titleText) === layout.valAxisTitle &&
		chartGridlinesState(chartData) === layout.majorGridlines &&
		Boolean(valAxis?.minorGridlines) === layout.minorGridlines &&
		!valAxis?.deleted === layout.valueAxis
	);
}

export const CHART_QUICK_LAYOUT_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const chartData = chartDataOf(ctx.element);
		return {
			id: 'chartQuickLayout',
			labelKey: 'pptx.gallery.chartQuickLayout.title',
			label: 'Quick Layout',
			disabled: !chartData,
			sections: [
				{
					id: 'layouts',
					columns: 4,
					tileWidth: TILE.width,
					tileHeight: TILE.height,
					items: CHART_QUICK_LAYOUTS.map((layout) => ({
						id: `layout${layout.n}`,
						labelKey: 'pptx.gallery.chartQuickLayout.layout',
						labelParams: { n: layout.n },
						label: `Layout ${layout.n}`,
						previewSvg: chartLayoutTileSvg(layout, TILE),
						applied: chartData ? matchesLayout(chartData, layout) : false,
					})),
				},
			],
		};
	},
	apply(itemId, ctx) {
		const element = ctx.element;
		const chartData = chartDataOf(element);
		const layout = CHART_QUICK_LAYOUTS.find((entry) => `layout${entry.n}` === itemId);
		if (!element || !chartData || !layout) {
			return null;
		}
		return {
			kind: 'element',
			elementId: element.id,
			patch: { chartData: applyChartQuickLayout(chartData, layout) } as Partial<PptxElement>,
		};
	},
};
