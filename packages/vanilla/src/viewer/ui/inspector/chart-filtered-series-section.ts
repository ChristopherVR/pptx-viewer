/**
 * chart-filtered-series-section.ts: PowerPoint's "Chart Filters" series
 * show/hide plus the per-series "Value From Cells" label cache editor,
 * mirroring React's `inspector/ChartFilteredSeriesOptions.tsx`.
 *
 * Three row groups, each rebuilt on every `update`:
 * - one row per VISIBLE series (only when the chart has more than one) with a
 *   hide button (`c15:filteredBarSeries` et al on save);
 * - one row per FILTERED series with a show button, the name falling back to
 *   `chartData.filteredSeriesTitle` and then a generic label, exactly as the
 *   shared restore action does;
 * - for every series carrying `dataLabelOptions.dataLabelsRange`, one text
 *   input per cached label string (`c15:dlblRangeCache`), labelled by the
 *   chart's category at that index.
 *
 * All decision logic lives in `pptx-viewer-shared`'s
 * `chart-ext-editor-actions` module (`hideChartSeries`,
 * `restoreFilteredSeries`, `setDataLabelsRangeCache`); this file only maps
 * it onto plain DOM controls (CLAUDE.md Rule 2). The section hides itself
 * when there is nothing to show, matching the React component returning null.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import {
	hideChartSeries,
	restoreFilteredSeries,
	setDataLabelsRangeCache,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';

export interface ChartFilteredSeriesSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
	/** Disable every control (read-only mode), same hook as the table data grid. */
	setEditable(editable: boolean): void;
}

export function createChartFilteredSeriesSection(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
): ChartFilteredSeriesSection {
	const el = doc.createElement('div');
	el.className = 'pptxv-chart-filters';
	el.hidden = true;

	const heading = doc.createElement('h5');
	heading.textContent = t('pptx.chart.chartFilters');

	const visibleList = doc.createElement('div');
	visibleList.className = 'pptxv-chart-filters-visible';
	const filteredList = doc.createElement('div');
	filteredList.className = 'pptxv-chart-filters-hidden';
	const rangeList = doc.createElement('div');
	rangeList.className = 'pptxv-chart-filters-ranges';

	el.append(heading, visibleList, filteredList, rangeList);

	let current: PptxChartData | undefined;
	let editable = true;

	function hideSeries(seriesIndex: number): void {
		const next = current && hideChartSeries(current, seriesIndex);
		if (next) {
			onChange(next);
		}
	}

	function restoreSeries(filteredIndex: number): void {
		const next = current && restoreFilteredSeries(current, filteredIndex);
		if (next) {
			onChange(next);
		}
	}

	function setLabelsRangeCache(seriesIndex: number, pointIndex: number, text: string): void {
		if (!current) {
			return;
		}
		onChange({
			...current,
			series: current.series.map((series, i) =>
				i === seriesIndex ? setDataLabelsRangeCache(series, pointIndex, text) : series,
			),
		});
	}

	function seriesRow(name: string, button: HTMLButtonElement, dimmed: boolean): HTMLElement {
		const row = doc.createElement('div');
		row.className = dimmed ? 'pptxv-chart-filters-row is-filtered' : 'pptxv-chart-filters-row';
		const label = doc.createElement('span');
		label.className = 'pptxv-chart-filters-name';
		label.title = name;
		label.textContent = name;
		row.append(label, button);
		return row;
	}

	function actionButton(testid: string, label: string, onClick: () => void): HTMLButtonElement {
		const button = doc.createElement('button');
		button.type = 'button';
		button.dataset.testid = testid;
		button.setAttribute('aria-label', label);
		button.title = label;
		button.textContent = label;
		button.disabled = !editable;
		button.addEventListener('click', onClick);
		return button;
	}

	function buildVisibleRows(data: PptxChartData): void {
		visibleList.replaceChildren();
		if (data.series.length <= 1) {
			return;
		}
		data.series.forEach((series, index) => {
			const label = t('pptx.chart.hideSeries', { name: series.name });
			const button = actionButton(`chart-series-hide-${index}`, label, () => hideSeries(index));
			visibleList.append(seriesRow(series.name, button, false));
		});
	}

	function buildFilteredRows(data: PptxChartData): void {
		filteredList.replaceChildren();
		(data.filteredSeries ?? []).forEach((filtered, index) => {
			const name = filtered.name ?? data.filteredSeriesTitle ?? t('pptx.chart.seriesShort');
			const label = t('pptx.chart.showSeries', { name });
			const button = actionButton(`chart-series-show-${index}`, label, () => restoreSeries(index));
			filteredList.append(seriesRow(name, button, true));
		});
	}

	function buildRangeRows(data: PptxChartData): void {
		rangeList.replaceChildren();
		data.series.forEach((series, seriesIndex) => {
			const range = series.dataLabelOptions?.dataLabelsRange;
			if (!range) {
				return;
			}
			const block = doc.createElement('div');
			block.className = 'pptxv-chart-filters-range';
			const caption = doc.createElement('div');
			caption.className = 'pptxv-chart-filters-range-title';
			caption.title = series.name;
			caption.textContent = t('pptx.chart.valueFromCells', { name: series.name });
			block.append(caption);
			range.cache.forEach((text, pointIndex) => {
				const field = doc.createElement('label');
				field.className = 'pptxv-chart-filters-range-field';
				const category = doc.createElement('span');
				const categoryLabel = data.categories[pointIndex] ?? String(pointIndex);
				category.textContent = categoryLabel;
				const input = doc.createElement('input');
				input.type = 'text';
				input.value = text;
				input.disabled = !editable;
				input.dataset.testid = `chart-dlbl-range-${seriesIndex}-${pointIndex}`;
				input.setAttribute('aria-label', categoryLabel);
				// `change` (commit on blur/enter) rather than `input`: every
				// keystroke would otherwise rebuild the row list under the cursor.
				input.addEventListener('change', () =>
					setLabelsRangeCache(seriesIndex, pointIndex, input.value),
				);
				field.append(category, input);
				block.append(field);
			});
			rangeList.append(block);
		});
	}

	function render(data: PptxChartData): void {
		current = data;
		const filteredCount = data.filteredSeries?.length ?? 0;
		const rangeCount = data.series.filter((s) => s.dataLabelOptions?.dataLabelsRange).length;
		el.hidden = filteredCount === 0 && rangeCount === 0 && data.series.length <= 1;
		if (el.hidden) {
			visibleList.replaceChildren();
			filteredList.replaceChildren();
			rangeList.replaceChildren();
			return;
		}
		buildVisibleRows(data);
		buildFilteredRows(data);
		buildRangeRows(data);
	}

	function applyEditable(): void {
		for (const control of el.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
			'button, input',
		)) {
			control.disabled = !editable;
		}
	}

	return {
		el,
		update: render,
		setEditable(next) {
			editable = next;
			applyEditable();
		},
	};
}
