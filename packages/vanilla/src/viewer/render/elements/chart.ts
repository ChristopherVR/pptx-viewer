import type { PptxChartData } from 'pptx-viewer-core';
import {
	buildChartViewModel,
	chartPlaceholderLabel,
	getChartStylePalette,
	getContainerStyle,
	resolveChartKind,
	resolveChartThreeViewSpec,
	resolveRevealedChartData,
	subscribeBarFacePicturePixelSamples,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../dom';
import type { ElementRenderer } from '../types';
import { attachChartEditing } from './chart-editable';
import { renderChartViewModelSvg } from './chart-svg';
import {
	isChart3DEditable,
	mountThreeViewInto,
	rendering3DFlagsOf,
	selectedChartPartOf,
	wireChartThreeViewEvents,
} from './three-view';

/**
 * Renderer for `chart` elements: the flat SVG below, upgraded to the shared
 * `<pptx-three-view>` 3D scene when the host opted this raw `c:chartType`
 * into 3D (`PptxViewerOptions.barChart3D` / `lineChart3D` / `areaChart3D` /
 * `pieChart3D` / `surfaceChart3D`; `resolveChartThreeViewSpec` decides). The
 * SVG becomes the element's slotted fallback, and a 3D mark's click/drag
 * feeds the SAME `onChartPartSelect` / `onChartPointChange` path as a 2D one.
 */
export const renderChartElement: ElementRenderer = (element, zIndex, context) => {
	const wrapper = renderChartSvgElement(element, zIndex, context);
	const spec = wrapper ? resolveChartThreeViewSpec(element, rendering3DFlagsOf(context)) : null;
	if (!wrapper || !spec) {
		return wrapper;
	}
	const view = mountThreeViewInto(context.document, wrapper, {
		spec,
		interactive: isChart3DEditable(element, context),
		selectedPart: selectedChartPartOf(element, context),
		textStyle: context.presentationStates?.get(element.id)?.textStyle,
	});
	wireChartThreeViewEvents(view, element, context, wrapper);
	return wrapper;
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
 * Exported so the 3D path above can build it as the scene's fallback.
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
	// controller surfaces a `build`/`chartReveal` descriptor that trims the
	// chart to the stages revealed so far. Mirrors Vue's `ChartRenderer` reveal.
	const animationState = context.presentationStates?.get(element.id);
	const chartData = element.chartData
		? resolveRevealedChartData(element.chartData, animationState)
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

	// An untargeted bar3D extrusion face whose fill is picture-only samples a
	// colour from the picture ASYNCHRONOUSLY (see `chart-bar3d-face-picture-
	// sample.ts`'s module doc for the COM-verified ground truth this
	// reproduces); `buildChartViewModel` only ever sees whatever is already
	// cached, so this repaints once a sample lands. Vanilla has no unmount
	// hook to unsubscribe from, so the listener self-unsubscribes the first
	// time it notices `container` left the document, rather than leaking one
	// subscription (and the closure's whole `container`/`paint` graph)
	// forever every time a slide with a bar3D picture-fill chart unmounts.
	const unsubscribe = subscribeBarFacePicturePixelSamples(() => {
		if (!container.isConnected) {
			unsubscribe();
			return;
		}
		paint(chartData);
	});

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
