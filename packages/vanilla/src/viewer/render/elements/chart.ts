import type { PptxChartData } from 'pptx-viewer-core';
import {
	applyChartBuildReveal,
	buildChartViewModel,
	chartPlaceholderLabel,
	getChartStylePalette,
	getContainerStyle,
	resolveChartKind,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../dom';
import type { ElementRenderer } from '../types';
import { renderChartViewModelSvg } from './chart-svg';

/**
 * Renderer for `chart` elements: an inline SVG built from the shared
 * `buildChartViewModel` engine (`pptx-viewer-shared`), projected to DOM by
 * `renderChartViewModelSvg`. Covers every kind the shared engine builds:
 *
 *   - bar / column (clustered, stacked, percentStacked), line / line3D,
 *     area / area3D, scatter, bubble, pie / doughnut / pie3D / ofPie, radar,
 *     including secondary / log / display-unit value axes plus trendline /
 *     error-bar / axis-title / data-table overlays
 *   - combo, stock, surface, treemap, waterfall, regionMap, funnel, sunburst,
 *     histogram, boxWhisker (sibling shared modules)
 *
 * Unsupported chart types and charts without series data render a labelled
 * placeholder box, mirroring Vue's `ChartRenderer.vue` fallback.
 *
 * Series colours resolve exactly like the Vue binding: an explicit parsed
 * `chartData.colorPalette` wins, otherwise the style-id-aware palette
 * (`getChartStylePalette`), threaded into the shared engine as `colorPalette`.
 */
export const renderChartElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'chart') {
		return null;
	}
	const doc = context.document;

	const container = createEl(
		doc,
		'div',
		'pptxv-element pptxv-chart',
		getContainerStyle(element, zIndex),
	);
	container.dataset.elementId = element.id;

	// Native staged chart build (`p:bldChart`): during a running presentation the
	// controller surfaces a `build` descriptor whose `progress` (0..1) trims the
	// chart to the stages revealed so far. Mirrors Vue's `ChartRenderer` reveal.
	const build = context.presentationStates?.get(element.id)?.build;
	const chartData =
		build?.kind === 'chart' && element.chartData
			? applyChartBuildReveal(element.chartData, build)
			: element.chartData;
	if (!chartData || chartData.series.length === 0) {
		container.appendChild(renderChartPlaceholder(doc, chartData?.chartType ?? 'bar', context.t));
		return container;
	}

	const kind = resolveChartKind(chartData.chartType ?? 'bar');
	if (kind === 'unsupported') {
		container.appendChild(renderChartPlaceholder(doc, chartData.chartType, context.t));
		return container;
	}

	// Thread the resolved palette into the shared engine (non-destructively)
	// so `seriesColor` / `paletteColor` produce the binding's colours.
	const themedElement = {
		...element,
		chartData: { ...chartData, colorPalette: resolveChartPalette(chartData) },
	};
	const vm = buildChartViewModel(themedElement);

	// Square chart kinds stay circular regardless of the element's aspect;
	// cartesian charts stretch to fill the element box.
	const preserveAspectRatio: 'none' | 'xMidYMid meet' =
		kind === 'pie' || kind === 'doughnut' || kind === 'radar' || kind === 'regionMap'
			? 'xMidYMid meet'
			: 'none';

	container.appendChild(renderChartViewModelSvg(doc, vm, preserveAspectRatio));
	return container;
};

/**
 * Resolve the colour palette for a chart, mirroring Vue's `resolveVuePalette`:
 * an explicit parsed `colorPalette` wins, otherwise the style-id palette
 * (which itself falls back to the default chart palette).
 */
export function resolveChartPalette(chartData: PptxChartData): string[] {
	if (chartData.colorPalette && chartData.colorPalette.length > 0) {
		return [...chartData.colorPalette];
	}
	return [...getChartStylePalette(chartData.style?.styleId)];
}

/** Labelled placeholder for unsupported / empty charts (mirrors Vue's). */
function renderChartPlaceholder(doc: Document, chartType: string, t: Translator): HTMLElement {
	const placeholder = createEl(doc, 'div', 'pptxv-placeholder pptxv-chart-placeholder', {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		height: '100%',
		fontSize: '11px',
		color: '#475569',
		background: '#f1f5f9',
		border: '1px dashed #cbd5e1',
		boxSizing: 'border-box',
	});
	placeholder.textContent = chartPlaceholderLabel(chartType, (key, params) => t(key, params));
	return placeholder;
}
