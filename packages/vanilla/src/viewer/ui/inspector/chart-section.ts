/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (an imperative DOM-builder with many independent `const`s), not one
   statement */
import type { PptxChartData } from 'pptx-viewer-core';
import type { ChartTypeSelectValue } from 'pptx-viewer-shared';
import {
	CHART_GROUPING_LABEL_KEYS,
	CHART_TYPE_LABEL_KEYS,
	CHART_TYPE_OPTIONS,
	patchChartData as sharedPatchChartData,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createChartAdvancedSection } from './chart-advanced-section';
import { createChartDataGrid } from './chart-data-grid';
import { tokenSelect } from './chart-exhaustive-controls';
import { createChartExhaustiveSection } from './chart-exhaustive-section';
import { createChartPointIndexField } from './chart-point-index';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * Derived from the same `CHART_TYPE_OPTIONS` catalogue Vue and Angular's
 * chart-type selects consume (React re-exports it too), rather than a
 * hand-spelled copy: this list used to omit histogram, boxWhisker and
 * regionMap, and separately drifted ahead of the other three bindings by
 * hand-adding funnel/treemap/sunburst.
 */
const CHART_TYPES: readonly ChartTypeSelectValue[] = CHART_TYPE_OPTIONS.map((opt) => opt.value);

/** `c:grouping` modes offered alongside the type, exactly as React offers them. */
const GROUPINGS: readonly string[] = ['clustered', 'stacked', 'percentStacked'];

export function createChartSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
) {
	const el = section(t('pptx.chart.data'));
	const title = input(doc, 'text', t('pptx.chart.title'));
	// Both selects used to be bare, unlabelled `<select>`s whose options were the
	// raw schema tokens (`percentStacked`, `doughnut`). React labels the same two
	// with `pptx.chart.type` / `pptx.chart.grouping` and spells the options from
	// the shared catalogues, so the value lists stay put and only the wording and
	// the accessible name change.
	const chartType = tokenSelect(doc, t('pptx.chart.type'), CHART_TYPES, CHART_TYPE_LABEL_KEYS, t);
	const grouping = tokenSelect(
		doc,
		t('pptx.chart.grouping'),
		GROUPINGS,
		CHART_GROUPING_LABEL_KEYS,
		t,
	);
	// The data grid replaces the old free-text categories/series textareas: the
	// textarea round-trip rebuilt every series from parsed text, silently
	// dropping per-series colour/marker/trendline fields the advanced controls
	// below had just set. The grid edits through core's `chartData*` helpers,
	// which preserve them.
	const grid = createChartDataGrid(doc, t, (data) => handlers.setChartData(data));
	const legend = checkbox(doc, t('pptx.chart.showLegend'));
	const labels = checkbox(doc, t('pptx.chart.dataLabels'));
	// One point picker drives every `c:dPt` control in the panel: the advanced
	// block renders it and edits the point fill/explosion, the exhaustive block
	// reuses the same selection for the point marker and invert-if-negative.
	// It is also driven FROM the canvas: a clicked mark's point index lands here
	// via `state.chartHighlightCell` below, so it always targets the point the
	// user just pressed rather than whatever was last typed.
	const pointIndex = createChartPointIndexField(doc, t);
	const advanced = createChartAdvancedSection(
		doc,
		t,
		(data) => handlers.setChartData(data),
		pointIndex,
	);
	const exhaustive = createChartExhaustiveSection(
		doc,
		t,
		(data) => handlers.setChartData(data),
		pointIndex,
	);
	el.append(
		title.label,
		chartType.label,
		grouping.label,
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
		// Route an actual type change through the shared `patchChartData`, not a
		// bare field assignment: that is what clears grouping the new type
		// doesn't support, adapts the category/series shape, and (for `'pareto'`,
		// which has no `PptxChartType` of its own; see docs/guide/limitations.md's
		// ChartEx row) converts to `chartType: 'histogram'` plus a
		// cumulative-percent series, matching React/Vue/Angular's chart-type
		// selectors.
		const selectedType = chartType.control.value as ChartTypeSelectValue;
		const base: PptxChartData =
			selectedType === current.chartType
				? current
				: sharedPatchChartData(current, { chartType: selectedType });
		handlers.setChartData({
			...base,
			title: title.control.value,
			grouping: grouping.control.value as PptxChartData['grouping'],
			style: {
				...base.style,
				hasTitle: title.control.value.trim().length > 0,
				hasLegend: legend.control.checked,
				hasDataLabels: labels.control.checked,
			},
		});
	};
	for (const control of [
		title.control,
		chartType.control,
		grouping.control,
		legend.control,
		labels.control,
	]) {
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
			chartType.control.value = current.chartType;
			grouping.control.value = current.grouping ?? 'clustered';
			// Point the shared index picker at the canvas-clicked point BEFORE the
			// advanced/exhaustive sections read it below, so their per-point fields
			// (fill, marker, invert-if-negative, ...) reflect the pressed mark.
			if (state.chartHighlightCell?.pointIndex !== undefined) {
				pointIndex.setSelected(state.chartHighlightCell.pointIndex);
			}
			grid.update(current, state.chartHighlightCell ?? null);
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
