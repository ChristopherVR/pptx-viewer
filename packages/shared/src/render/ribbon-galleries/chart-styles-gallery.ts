/**
 * Chart Design > Chart Styles: the curated recolour presets the on-canvas
 * chart quick actions already offer (`chart-quick-action-styles.ts`), as a
 * ribbon gallery. A pick is `applyChartStylePreset`, then each series' new
 * palette colour is pinned on `series.color` as well: the core save path only
 * rewrites an existing `c:ser/c:spPr` fill when `series.color` is set, so
 * without it the saved file would keep the pre-pick colours.
 *
 * @module render/ribbon-galleries/chart-styles-gallery
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { applyChartStylePreset, buildChartStylePresets } from '../chart-quick-action-styles';
import { columnChartTileSvg } from './chart-gallery-tiles';
import type { RibbonGalleryModule } from './gallery-module';

const TILE = { width: 60, height: 44 };

/** English names of the presets (their i18n keys are the quick-action ones). */
const PRESET_LABELS: Readonly<Record<string, string>> = {
	colorful: 'Colorful',
	monochrome: 'Monochrome',
	colorfulLight: 'Colorful Light',
	colorfulDark: 'Colorful Dark',
	mutedDark: 'Muted Dark',
	pastel: 'Pastel',
};

function chartDataOf(element: PptxElement | null): PptxChartData | undefined {
	return element?.type === 'chart' ? element.chartData : undefined;
}

/** A preset applied, with its palette pinned per series so it survives a save. */
export function applyChartStyleGalleryPreset(
	chartData: PptxChartData,
	presetId: string,
): PptxChartData | null {
	const next = applyChartStylePreset(chartData, presetId);
	if (!next?.colorPalette?.length || chartData.varyColors) {
		return next;
	}
	const palette = next.colorPalette;
	return {
		...next,
		series: next.series.map((series, i) => ({ ...series, color: palette[i % palette.length] })),
	};
}

export const CHART_STYLES_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const chartData = chartDataOf(ctx.element);
		const presets = buildChartStylePresets(chartData ?? { colorPalette: undefined });
		return {
			id: 'chartStyles',
			labelKey: 'pptx.gallery.chartStyles.title',
			label: 'Chart Styles',
			disabled: !chartData,
			sections: [
				{
					id: 'styles',
					columns: 6,
					tileWidth: TILE.width,
					tileHeight: TILE.height,
					items: presets.map((preset) => ({
						id: preset.id,
						labelKey: preset.labelKey,
						label: PRESET_LABELS[preset.id] ?? preset.id,
						previewSvg: columnChartTileSvg(preset.colors, TILE),
						applied: preset.applied,
					})),
				},
			],
		};
	},
	apply(itemId, ctx) {
		const element = ctx.element;
		const chartData = chartDataOf(element);
		const next = chartData ? applyChartStyleGalleryPreset(chartData, itemId) : null;
		if (!element || !next) {
			return null;
		}
		return {
			kind: 'element',
			elementId: element.id,
			patch: { chartData: next } as Partial<PptxElement>,
		};
	},
};
