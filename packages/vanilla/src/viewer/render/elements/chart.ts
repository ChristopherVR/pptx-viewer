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
import { renderAreaChart3DElement } from './area-chart-3d';
import { renderBarChart3DElement } from './bar-chart-3d';
import { attachChartEditing } from './chart-editable';
import { renderChartViewModelSvg } from './chart-svg';
import { renderLineChart3DElement } from './line-chart-3d';
import { renderPieChart3DElement } from './pie-chart-3d';
import { renderSurfaceChart3DElement } from './surface-chart-3d';

/**
 * Renderer for `chart` elements. Dispatches to the opt-in interactive
 * Three.js surface-chart scene (`surface-chart-3d.ts`) when
 * `context.surfaceChart3D` is set (see `PptxViewerOptions.surfaceChart3D`)
 * and the chart resolves to the `surface` kind, to the opt-in interactive
 * Three.js bar3D-chart scene (`bar-chart-3d.ts`) when `context.barChart3D`
 * is set (see `PptxViewerOptions.barChart3D`) and the chart's raw
 * `chartType` is `bar3D`, to the opt-in interactive Three.js line3D-chart
 * scene (`line-chart-3d.ts`) when `context.lineChart3D` is set (see
 * `PptxViewerOptions.lineChart3D`) and the chart's raw `chartType` is
 * `line3D`, or to the opt-in interactive Three.js area3D-chart scene
 * (`area-chart-3d.ts`) when `context.areaChart3D` is set (see
 * `PptxViewerOptions.areaChart3D`) and the chart's raw `chartType` is
 * `area3D` (each checked directly against the raw `chartType`, NOT via
 * `resolveChartKind`, which folds plain/3D variants together), otherwise
 * `chartType` is `bar3D` (checked directly, NOT via `resolveChartKind`,
 * which folds plain `bar` and `bar3D` together), or to the opt-in interactive
 * Three.js pie3D-chart scene (`pie-chart-3d.ts`) when `context.pieChart3D`
 * is set (see `PptxViewerOptions.pieChart3D`) and the chart's raw
 * `chartType` is `pie3D` (checked directly, NOT via `resolveChartKind`,
 * which folds plain `pie`/`doughnut` and `pie3D` together), otherwise
 * renders the flat SVG below. Mirrors `smartart.ts`'s `renderSmartArtElement`
 * dispatch.
 */
export const renderChartElement: ElementRenderer = (element, zIndex, context) => {
	if (
		element.type === 'chart' &&
		context.surfaceChart3D &&
		element.chartData &&
		resolveChartKind(element.chartData.chartType ?? 'bar') === 'surface'
	) {
		return renderSurfaceChart3DElement(element, zIndex, context);
	}
	if (element.type === 'chart' && context.barChart3D && element.chartData?.chartType === 'bar3D') {
		return renderBarChart3DElement(element, zIndex, context);
	}
	if (
		element.type === 'chart' &&
		context.lineChart3D &&
		element.chartData?.chartType === 'line3D'
	) {
		return renderLineChart3DElement(element, zIndex, context);
	}
	if (
		element.type === 'chart' &&
		context.areaChart3D &&
		element.chartData?.chartType === 'area3D'
	) {
		return renderAreaChart3DElement(element, zIndex, context);
	if (element.type === 'chart' && context.pieChart3D && element.chartData?.chartType === 'pie3D') {
		return renderPieChart3DElement(element, zIndex, context);
	}
	return renderChartSvgElement(element, zIndex, context);
};

/**
 * The flat SVG chart renderer: an inline SVG built from the shared
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
 *
 * Exported (not just registry-internal) so `surface-chart-3d.ts` can paint
 * this as its synchronous fallback / restore target, mirroring
 * `smartart.ts`'s exported `renderSmartArtSvg`.
 */
export const renderChartSvgElement: ElementRenderer = (element, zIndex, context) => {
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

	// Square chart kinds stay circular regardless of the element's aspect;
	// cartesian charts stretch to fill the element box.
	const preserveAspectRatio: 'none' | 'xMidYMid meet' =
		kind === 'pie' || kind === 'doughnut' || kind === 'radar' || kind === 'regionMap'
			? 'xMidYMid meet'
			: 'none';

	/**
	 * Project `data` into the container, replacing any SVG already there.
	 *
	 * Reused as the repaint hook for on-canvas value dragging: the drag previews
	 * locally (no editor round trip per pointermove) and commits once on release.
	 */
	const paint = (data: PptxChartData): void => {
		// Thread the resolved palette into the shared engine (non-destructively)
		// so `seriesColor` / `paletteColor` produce the binding's colours.
		const themedElement = {
			...element,
			chartData: { ...data, colorPalette: resolveChartPalette(data) },
		};
		container.querySelector('svg')?.remove();
		container.appendChild(
			renderChartViewModelSvg(doc, buildChartViewModel(themedElement), preserveAspectRatio),
		);
	};

	paint(chartData);
	attachChartEditing(container, element, context, paint);
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
