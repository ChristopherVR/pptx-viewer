/**
 * Vue adapter for the framework-agnostic chart view-model engine.
 *
 * `pptx-viewer-shared`'s `buildChartViewModel` projects a chart `PptxElement`
 * into a `ChartViewModel` of pure `SvgPrimitive` descriptors. `ChartViewModelSvg.vue`
 * maps that descriptor list to Vue template SVG, mirroring React's
 * `chart-view-model-render.tsx`, so React, Vue and Angular share one
 * geometry / layout / data engine and only the markup emission stays
 * per-framework.
 *
 * Colour preservation: the shared engine resolves series colours from
 * `chartData.colorPalette` (falling back to its own Office-accent default).
 * Vue historically resolves colours via the style-id-aware palette
 * (`getChartStylePalette` / `seriesColor(series, i, styleId, palette)` in
 * `chart-helpers.ts`). To keep Vue's colours unchanged while aligning only the
 * geometry, `buildVueChartViewModel` resolves Vue's palette and injects it as
 * `colorPalette` before invoking the shared builder.
 *
 * @module chart-view-model
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { buildChartViewModel, getChartStylePalette } from 'pptx-viewer-shared';
import type { ChartViewModel } from 'pptx-viewer-shared';

/**
 * Resolve the colour palette Vue uses for a chart, mirroring the precedence of
 * `seriesColor(series, i, styleId, colorPalette)` in `chart-helpers.ts`: an
 * explicit parsed `colorPalette` wins, otherwise the style-id palette (which
 * itself falls back to the default chart palette).
 */
export function resolveVuePalette(chartData: PptxChartData): string[] {
	if (chartData.colorPalette && chartData.colorPalette.length > 0) {
		return [...chartData.colorPalette];
	}
	return [...getChartStylePalette(chartData.style?.styleId)];
}

/**
 * Build the shared `ChartViewModel` for a chart element using Vue's resolved
 * palette. The element's `chartData.colorPalette` is overlaid (non-destructively)
 * with Vue's palette so the shared engine's `seriesColor` / `paletteColor`
 * produce Vue's historical colours; only geometry aligns across frameworks.
 */
export function buildVueChartViewModel(element: PptxElement): ChartViewModel {
	if (element.type !== 'chart' || !element.chartData) {
		return buildChartViewModel(element);
	}
	const palette = resolveVuePalette(element.chartData);
	const themedElement: PptxElement = {
		...element,
		chartData: { ...element.chartData, colorPalette: palette },
	};
	return buildChartViewModel(themedElement);
}
