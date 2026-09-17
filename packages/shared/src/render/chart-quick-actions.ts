/**
 * chart-quick-actions.ts: PowerPoint's three floating quick-action icons
 * shown just outside a selected chart's top-right corner ("Chart Elements"
 * "+", "Chart Styles" paintbrush, "Chart Filters" funnel).
 *
 * {@link buildChartQuickActionsDescriptor} is the pure decision function
 * (CLAUDE.md Rule 2): given the selected element and its on-screen selection
 * box, it decides whether the three buttons should render, where they anchor,
 * and what each popover's checklist/gallery/list contains, all in
 * framework-neutral terms. Every binding does nothing but:
 *
 *   1. Render three small buttons at `descriptor.buttons[i].x/y/size`
 *      (already in the SAME coordinate space as the caller's `selectionBox`,
 *      e.g. on-screen CSS px after zoom, so no per-binding geometry is
 *      needed).
 *   2. Render each popover's list from `descriptor.elements` /
 *      `descriptor.filters` / `descriptor.styles`.
 *   3. On a checklist/gallery interaction, call straight into the existing
 *      shared mutation functions this descriptor's checked/applied state was
 *      computed from: {@link applyChartElementToggle}
 *      (`chart-quick-action-toggles.ts`), `hideChartSeries`/
 *      `restoreFilteredSeries` (`chart-ext-editor-actions.ts`), and
 *      {@link applyChartStylePreset} (`chart-quick-action-styles.ts`). No
 *      binding re-implements any toggle/filter/recolour logic itself.
 *
 * Scope notes (see this module's tests and the tracking notes for the
 * feature): "Chart Filters" only exposes the Series tab (show/hide a whole
 * series, PowerPoint's `c15:filteredSeries`, already round-tripped by core).
 * A "Categories" tab is NOT implemented: unlike a filtered series, a filtered
 * CATEGORY has no dedicated storage in this codebase (`chart-filtered-series.ts`'s
 * header explains PowerPoint itself only shortens every series' cached
 * points, which this codebase already reads losslessly but does not model as
 * a togglable per-category flag). "Chart Elements" omits trendline/error-bar/
 * up-down-bars visibility: those are per-series and already have their own
 * dedicated inspector panels (`ChartTrendlineOptions`/`ChartErrorBarOptions`
 * and siblings); adding them to this popover is future work, not silently
 * dropped functionality.
 *
 * @module render/chart-quick-actions
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { chartGridlinesState } from './chart-gridlines-toggle';
import type { ChartStylePresetDescriptor } from './chart-quick-action-styles';
import { buildChartStylePresets } from './chart-quick-action-styles';
import type { ChartQuickElementKey } from './chart-quick-action-toggles';
import { chartAxesVisibilityState, chartAxisTitlesState } from './chart-quick-action-toggles';
import type { InteractionBox } from './element-interaction';

/** One of the three floating quick-action icons. */
export type ChartQuickActionId = 'elements' | 'styles' | 'filters';

/** A floating quick-action button's on-screen position, in the caller's box coordinate space. */
export interface ChartQuickActionButtonDescriptor {
	id: ChartQuickActionId;
	labelKey: string;
	x: number;
	y: number;
	size: number;
}

/** One "Chart Elements" checklist row. */
export interface ChartQuickElementItemDescriptor {
	key: ChartQuickElementKey;
	labelKey: string;
	checked: boolean;
}

/** One "Chart Filters" series row: exactly one of `seriesIndex`/`filteredIndex` is set. */
export interface ChartQuickFilterSeriesDescriptor {
	key: string;
	name: string;
	visible: boolean;
	seriesIndex?: number;
	filteredIndex?: number;
}

export interface ChartQuickActionsDescriptor {
	buttons: ChartQuickActionButtonDescriptor[];
	elements: ChartQuickElementItemDescriptor[];
	filters: { visible: boolean; series: ChartQuickFilterSeriesDescriptor[] };
	styles: { presets: ChartStylePresetDescriptor[] };
}

/** Button edge length, in the same units as the caller's `selectionBox`. */
export const CHART_QUICK_ACTION_BUTTON_SIZE = 24;
/** Gap between stacked buttons. */
const BUTTON_GAP = 6;
/** Gap between the chart's selection box and the button column, matching PowerPoint's offset. */
const OUTSIDE_GAP = 8;

const BUTTON_ORDER: ReadonlyArray<{ id: ChartQuickActionId; labelKey: string }> = [
	{ id: 'elements', labelKey: 'pptx.chart.quickElements' },
	{ id: 'styles', labelKey: 'pptx.chart.quickStyles' },
	{ id: 'filters', labelKey: 'pptx.chart.quickFilters' },
];

function buildButtons(
	selectionBox: InteractionBox,
	showFilters: boolean,
): ChartQuickActionButtonDescriptor[] {
	const x = selectionBox.x + selectionBox.width + OUTSIDE_GAP;
	return BUTTON_ORDER.filter((entry) => entry.id !== 'filters' || showFilters).map((entry, i) => ({
		...entry,
		x,
		y: selectionBox.y + i * (CHART_QUICK_ACTION_BUTTON_SIZE + BUTTON_GAP),
		size: CHART_QUICK_ACTION_BUTTON_SIZE,
	}));
}

function buildElements(chartData: PptxChartData): ChartQuickElementItemDescriptor[] {
	const items: ChartQuickElementItemDescriptor[] = [
		{ key: 'title', labelKey: 'pptx.chart.showTitle', checked: chartData.style?.hasTitle ?? false },
		{
			key: 'legend',
			labelKey: 'pptx.chart.showLegend',
			checked: chartData.style?.hasLegend ?? false,
		},
		{
			key: 'gridlines',
			labelKey: 'pptx.chart.showGridlines',
			checked: chartGridlinesState(chartData),
		},
		{
			key: 'dataLabels',
			labelKey: 'pptx.chart.showDataLabels',
			checked: chartData.style?.hasDataLabels ?? false,
		},
	];
	if (chartData.axes && chartData.axes.length > 0) {
		items.push({
			key: 'axes',
			labelKey: 'pptx.chart.quickAxes',
			checked: chartAxesVisibilityState(chartData),
		});
		items.push({
			key: 'axisTitles',
			labelKey: 'pptx.chart.quickAxisTitles',
			checked: chartAxisTitlesState(chartData),
		});
	}
	return items;
}

function buildFilters(chartData: PptxChartData): {
	visible: boolean;
	series: ChartQuickFilterSeriesDescriptor[];
} {
	const visibleSeries = chartData.series.map((series, index) => ({
		key: `visible-${index}`,
		name: series.name,
		visible: true,
		seriesIndex: index,
	}));
	const filtered = (chartData.filteredSeries ?? []).map((entry, index) => ({
		key: `filtered-${index}`,
		name: entry.name ?? chartData.filteredSeriesTitle ?? `Series ${index + 1}`,
		visible: false,
		filteredIndex: index,
	}));
	const series = [...visibleSeries, ...filtered];
	return { visible: series.length > 1, series };
}

/**
 * Build the quick-action descriptor for the currently-selected element.
 * Returns `null` when the quick actions should not render (nothing selected,
 * the selection is not a chart, or the chart has no data yet).
 */
export function buildChartQuickActionsDescriptor(input: {
	isChartSelected: boolean;
	chartData: PptxChartData | undefined;
	selectionBox: InteractionBox;
}): ChartQuickActionsDescriptor | null {
	if (!input.isChartSelected || !input.chartData) {
		return null;
	}
	const { chartData, selectionBox } = input;
	const filters = buildFilters(chartData);
	return {
		buttons: buildButtons(selectionBox, filters.visible),
		elements: buildElements(chartData),
		filters,
		styles: { presets: buildChartStylePresets(chartData) },
	};
}
