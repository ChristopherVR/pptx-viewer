import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import type { ChartPartRef, ChartViewModel } from 'pptx-viewer-shared';
import {
	buildChartViewModel,
	chartPartToAttrs,
	chartPlaceholderLabel,
	getChartStylePalette,
	resolveChartKind,
} from 'pptx-viewer-shared';

/**
 * View-model resolution for `chart` elements (port of the vanilla binding's
 * `renderChartElement`). The shared `buildChartViewModel` engine does all the
 * chart maths and projects the chart into pure `SvgPrimitive` descriptors;
 * this module only resolves the palette / aspect ratio and lays out the
 * legend so the `ChartView` SFC template stays declarative.
 */

const LEGEND_ITEM_WIDTH = 80;

/** Resolved chart view: a renderable view model, or a labelled placeholder. */
export type ChartView =
	| { kind: 'chart'; vm: ChartViewModel; preserveAspectRatio: 'none' | 'xMidYMid meet' }
	| { kind: 'placeholder'; label: string };

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

/**
 * Build the renderable view (or placeholder) for a chart element.
 *
 * @param translate - The binding's translator, used for the placeholder
 *   caption. It is optional so the pure unit tests can call this without an
 *   i18n context; a viewer always passes one.
 */
export function buildChartView(
	element: ChartPptxElement,
	translate?: (key: string, params?: Record<string, string>) => string,
): ChartView {
	const chartData = element.chartData;
	const placeholder = (chartType: string | undefined): ChartView => ({
		kind: 'placeholder',
		label: translate ? chartPlaceholderLabel(chartType, translate) : `Chart: ${chartType ?? 'bar'}`,
	});
	if (!chartData || chartData.series.length === 0) {
		return placeholder(chartData?.chartType ?? 'bar');
	}

	const kind = resolveChartKind(chartData.chartType ?? 'bar');
	if (kind === 'unsupported') {
		return placeholder(chartData.chartType);
	}

	// Thread the resolved palette into the shared engine (non-destructively)
	// so `seriesColor` / `paletteColor` produce the binding's colours.
	const themedElement: ChartPptxElement = {
		...element,
		chartData: { ...chartData, colorPalette: resolveChartPalette(chartData) },
	};

	// Square chart kinds stay circular regardless of the element's aspect;
	// cartesian charts stretch to fill the element box.
	const preserveAspectRatio: 'none' | 'xMidYMid meet' =
		kind === 'pie' || kind === 'doughnut' || kind === 'radar' || kind === 'regionMap'
			? 'xMidYMid meet'
			: 'none';

	return { kind: 'chart', vm: buildChartViewModel(themedElement), preserveAspectRatio };
}

/** One positioned legend entry (swatch + label). */
export interface ChartLegendItem {
	key: string;
	transform: string;
	color: string;
	label: string;
}

/** Legend layout: a horizontal row, or a vertical stack on the side. */
export function buildLegendItems(vm: ChartViewModel): ChartLegendItem[] {
	const vertical = vm.legendAnchor === 'start';
	return vm.legend.map((entry, i) => {
		const x = vertical
			? vm.legendX
			: vm.legendX - (vm.legend.length * LEGEND_ITEM_WIDTH) / 2 + i * LEGEND_ITEM_WIDTH;
		const y = vertical ? vm.legendY + i * 14 : vm.legendY;
		return {
			key: `lg${i}`,
			transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`,
			color: entry.color,
			label: entry.label,
		};
	});
}

/**
 * `data-chart-*` hit-testing attributes for a tagged data-mark primitive.
 * Inert without pointer events; emitted for parity with the other bindings so
 * hosts layering interaction on top can reuse the same shared hit-testing.
 */
export function partAttrs(part: ChartPartRef | undefined): Record<string, string> {
	return part ? chartPartToAttrs(part) : {};
}
