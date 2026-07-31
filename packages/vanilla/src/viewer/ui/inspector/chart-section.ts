import type { PptxChartData, PptxChartType } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createChartAdvancedSection } from './chart-advanced-section';
import { createChartDataGrid } from './chart-data-grid';
import { createChartExhaustiveSection } from './chart-exhaustive-section';
import type { InspectorHandlers, InspectorState } from './types';

const CHART_TYPES: readonly PptxChartType[] = [
	'bar',
	'line',
	'pie',
	'doughnut',
	'area',
	'scatter',
	'bubble',
	'radar',
	'waterfall',
	'funnel',
	'treemap',
	'sunburst',
	'combo',
];

export function createChartSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
) {
	const el = section(t('pptx.chart.data'));
	const title = input(doc, 'text', t('pptx.chart.title'));
	const chartType = doc.createElement('select');
	for (const value of CHART_TYPES) {
		addOption(doc, chartType, value);
	}
	const grouping = doc.createElement('select');
	for (const value of ['clustered', 'stacked', 'percentStacked']) {
		addOption(doc, grouping, value);
	}
	// The data grid replaces the old free-text categories/series textareas: the
	// textarea round-trip rebuilt every series from parsed text, silently
	// dropping per-series colour/marker/trendline fields the advanced controls
	// below had just set. The grid edits through core's `chartData*` helpers,
	// which preserve them.
	const grid = createChartDataGrid(doc, t, (data) => handlers.setChartData(data));
	const legend = checkbox(doc, t('pptx.chart.showLegend'));
	const labels = checkbox(doc, t('pptx.chart.dataLabels'));
	const advanced = createChartAdvancedSection(doc, t, (data) => handlers.setChartData(data));
	const exhaustive = createChartExhaustiveSection(doc, t, (data) => handlers.setChartData(data));
	el.append(
		title.label,
		chartType,
		grouping,
		grid.el,
		legend.label,
		labels.label,
		advanced.el,
		exhaustive.el,
	);

	let current: PptxChartData | undefined;
	const commit = (): void => {
		if (!current) {
			return;
		}
		handlers.setChartData({
			...current,
			title: title.control.value,
			chartType: chartType.value as PptxChartType,
			grouping: grouping.value as PptxChartData['grouping'],
			style: {
				...current.style,
				hasTitle: title.control.value.trim().length > 0,
				hasLegend: legend.control.checked,
				hasDataLabels: labels.control.checked,
			},
		});
	};
	for (const control of [title.control, chartType, grouping, legend.control, labels.control]) {
		control.addEventListener('change', commit);
	}

	return {
		el,
		update(state: InspectorState) {
			el.hidden = !state.isChart;
			current = state.chartData;
			if (!current) {
				return;
			}
			title.control.value = current.title ?? '';
			chartType.value = current.chartType;
			grouping.value = current.grouping ?? 'clustered';
			grid.update(current);
			legend.control.checked = current.style?.hasLegend ?? false;
			labels.control.checked = current.style?.hasDataLabels ?? false;
			advanced.update(current);
			exhaustive.update(current);
		},
	};
}

function input(doc: Document, type: string, text: string) {
	const label = doc.createElement('label');
	label.textContent = text;
	const control = doc.createElement('input');
	control.type = type;
	label.appendChild(control);
	return { label, control };
}

function checkbox(doc: Document, text: string) {
	const field = input(doc, 'checkbox', text);
	return field;
}

function addOption(doc: Document, select: HTMLSelectElement, value: string): void {
	const option = doc.createElement('option');
	option.value = value;
	option.textContent = value;
	select.appendChild(option);
}
