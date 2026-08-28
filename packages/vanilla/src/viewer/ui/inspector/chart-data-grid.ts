/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (an imperative DOM-builder with many independent `const`s), not one
   statement */
import type { PptxChartData } from 'pptx-viewer-core';
import {
	addChartCategory,
	addChartSeries,
	removeChartCategory,
	removeChartSeries,
	setChartCategoryLabel,
	setChartCellValue,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * The chart data grid (React's `ChartDataGrid`): a spreadsheet-style editor
 * with one column per series and one row per category, plus add/remove buttons
 * for both axes.
 *
 * Every edit goes through `pptx-viewer-shared/chart-data-grid-ops`, which owns
 * the policy (auto-naming, refusing to delete the last series/category,
 * rejecting non-numeric input) so vanilla behaves exactly like the other
 * bindings. Those helpers return `null` when an edit must not happen, and this
 * view simply does not commit then.
 *
 * The table is rebuilt on each `update`: a chart grid is small (tens of cells)
 * and diffing rows against live DOM is how an imperative table starts quietly
 * editing the wrong cell after a row is removed.
 *
 * `update`'s `highlightCell` argument is driven by the on-canvas chart part
 * selection (mirrors Vue's `ChartDataGrid` `highlightCell` prop): a
 * `pointIndex` ring-highlights one value cell, series-only (no `pointIndex`)
 * ring-highlights the series name header, and the highlighted cell is
 * scrolled into view.
 */
export interface ChartHighlightCell {
	seriesIndex: number;
	pointIndex?: number;
}

const HIGHLIGHT_CLASS = 'pptxv-chart-grid-cell-highlight';

export function createChartDataGrid(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
	/**
	 * File > Options > Advanced > "Properties follow chart data point for
	 * current workbook", read fresh on every category removal. Defaults to
	 * PowerPoint's own default (`true`) when omitted.
	 */
	getFollowDataPoint: () => boolean = () => true,
) {
	const el = createEl(doc, 'div', 'pptxv-chart-grid');
	const toolbar = createEl(doc, 'div', 'pptxv-chart-grid-toolbar');
	const table = doc.createElement('table');
	table.className = 'pptxv-chart-grid-table';

	const toolbarButton = (text: string, label: string, run: () => void): HTMLButtonElement => {
		const button = createEl(doc, 'button', 'pptxv-chart-grid-btn');
		button.type = 'button';
		button.textContent = `+ ${text}`;
		button.title = label;
		button.setAttribute('aria-label', label);
		button.addEventListener('click', run);
		return button;
	};

	let current: PptxChartData | undefined;
	/** Commit a helper result, ignoring the `null` "edit refused" answer. */
	const commit = (next: PptxChartData | null): void => {
		if (next) {
			onChange(next);
		}
	};

	const addCategory = toolbarButton(t('pptx.chart.cat'), t('pptx.chart.addCategory'), () => {
		if (current) {
			commit(addChartCategory(current));
		}
	});
	const addSeries = toolbarButton(t('pptx.chart.seriesShort'), t('pptx.chart.addSeries'), () => {
		if (current) {
			commit(addChartSeries(current));
		}
	});
	toolbar.append(addCategory, addSeries);
	el.append(toolbar, table);

	const cellInput = (
		type: 'text' | 'number',
		value: string,
		ariaLabel: string,
		apply: (raw: string) => void,
	): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = type;
		input.className = 'pptxv-chart-grid-cell';
		input.value = value;
		input.setAttribute('aria-label', ariaLabel);
		input.addEventListener('change', () => apply(input.value));
		// The editor's global key handling treats Delete / arrows as canvas
		// commands, so keep them inside the cell being typed into.
		input.addEventListener('keydown', (event) => event.stopPropagation());
		return input;
	};

	const removeButton = (label: string, run: () => void): HTMLButtonElement => {
		const button = createEl(doc, 'button', 'pptxv-chart-grid-remove');
		button.type = 'button';
		button.textContent = '×';
		button.title = label;
		button.setAttribute('aria-label', label);
		button.addEventListener('click', run);
		return button;
	};

	/**
	 * Pad a series that has fewer values than there are categories, so a ragged
	 * deck (legal in OOXML) can still be edited: the shared cell setter refuses
	 * an index past the end of a series.
	 */
	const padSeries = (data: PptxChartData, seriesIndex: number, upTo: number): PptxChartData => {
		const values = [...data.series[seriesIndex].values];
		while (values.length <= upTo) {
			values.push(0);
		}
		return {
			...data,
			series: data.series.map((series, index) =>
				index === seriesIndex ? { ...series, values } : series,
			),
		};
	};

	const buildHead = (
		data: PptxChartData,
		highlightCell: ChartHighlightCell | null,
	): HTMLTableSectionElement => {
		const head = doc.createElement('thead');
		const row = doc.createElement('tr');
		const corner = doc.createElement('th');
		corner.setAttribute('aria-label', t('pptx.chart.categories'));
		row.appendChild(corner);
		data.series.forEach((series, seriesIndex) => {
			const cell = doc.createElement('th');
			const nameInput = cellInput('text', series.name, t('pptx.chart.seriesShort'), (raw) =>
				onChange({
					...data,
					series: data.series.map((entry, index) =>
						index === seriesIndex ? { ...entry, name: raw } : entry,
					),
				}),
			);
			// Series-only selection (a clicked series line, no point): no `pointIndex`.
			if (highlightCell?.seriesIndex === seriesIndex && highlightCell.pointIndex === undefined) {
				nameInput.classList.add(HIGHLIGHT_CLASS);
			}
			cell.appendChild(nameInput);
			if (data.series.length > 1) {
				cell.appendChild(
					removeButton(t('pptx.chart.removeSeries'), () =>
						commit(removeChartSeries(data, seriesIndex)),
					),
				);
			}
			row.appendChild(cell);
		});
		head.appendChild(row);
		return head;
	};

	const buildBody = (
		data: PptxChartData,
		highlightCell: ChartHighlightCell | null,
	): HTMLTableSectionElement => {
		const body = doc.createElement('tbody');
		data.categories.forEach((category, categoryIndex) => {
			const row = doc.createElement('tr');
			const labelCell = doc.createElement('td');
			labelCell.appendChild(
				cellInput('text', category, t('pptx.chart.categories'), (raw) =>
					commit(setChartCategoryLabel(data, categoryIndex, raw)),
				),
			);
			if (data.categories.length > 1) {
				labelCell.appendChild(
					removeButton(t('pptx.chart.removeCategory'), () =>
						commit(removeChartCategory(data, categoryIndex, getFollowDataPoint())),
					),
				);
			}
			row.appendChild(labelCell);
			data.series.forEach((series, seriesIndex) => {
				const cell = doc.createElement('td');
				const valueInput = cellInput(
					'number',
					String(series.values[categoryIndex] ?? 0),
					`${series.name} value ${categoryIndex + 1}`,
					(raw) => {
						const padded =
							categoryIndex >= series.values.length
								? padSeries(data, seriesIndex, categoryIndex)
								: data;
						commit(setChartCellValue(padded, seriesIndex, categoryIndex, raw));
					},
				);
				if (
					highlightCell?.seriesIndex === seriesIndex &&
					highlightCell.pointIndex === categoryIndex
				) {
					valueInput.classList.add(HIGHLIGHT_CLASS);
				}
				cell.appendChild(valueInput);
				row.appendChild(cell);
			});
			body.appendChild(row);
		});
		return body;
	};

	// Only the on-canvas click that CHANGED the selection should pull the panel
	// scroll position around; an unrelated inspector refresh (another keystroke,
	// another element's edit) must not re-scroll to a selection that has not
	// moved. Mirrors the Vue grid's `watch` on `[seriesIndex, pointIndex]`.
	let lastHighlightKey: string | null = null;

	return {
		el,
		update(data: PptxChartData | undefined, highlightCell: ChartHighlightCell | null = null) {
			current = data;
			el.hidden = !data;
			if (!data) {
				return;
			}
			table.textContent = '';
			table.append(buildHead(data, highlightCell), buildBody(data, highlightCell));
			const key = highlightCell
				? `${highlightCell.seriesIndex}:${highlightCell.pointIndex ?? ''}`
				: null;
			if (key !== null && key !== lastHighlightKey) {
				table.querySelector(`.${HIGHLIGHT_CLASS}`)?.scrollIntoView?.({
					block: 'nearest',
					inline: 'nearest',
				});
			}
			lastHighlightKey = key;
		},
		setDisabled(disabled: boolean) {
			addCategory.disabled = disabled;
			addSeries.disabled = disabled;
			for (const input of table.querySelectorAll('input')) {
				input.disabled = disabled;
			}
		},
	};
}
