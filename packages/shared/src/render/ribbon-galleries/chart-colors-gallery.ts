/**
 * Chart Design > Change Colors: Colorful Palettes 1-4 and Monochromatic
 * Palettes 1-13 (`Chart.ChartColor` 10..26), resolved per series exactly as
 * PowerPoint derives them (see `chart-color-palette-catalog.ts`).
 *
 * A pick writes each series' colour explicitly, as PowerPoint does
 * (`c:ser/c:spPr/a:solidFill`); the core save path rewrites an existing
 * series fill only when `series.color` is set, so clearing the colour (as
 * `applyChartStylePreset` does) would leave the old fill in the saved file.
 * It also clears per-point / marker fill overrides and records the palette on
 * `colorPalette` / `colorMethod`, which core writes to the chart's
 * `chartColorStyle` part. That part is written as resolved `a:srgbClr`
 * entries without PowerPoint's `cs:variation` list (the core writer's model),
 * and `withinLinearReversed` is stored as its resolved per-series list.
 * Charts with `varyColors` (pie, doughnut) take the palette per category.
 *
 * @module render/ribbon-galleries/chart-colors-gallery
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { clearSeriesColor } from '../chart-quick-action-styles';
import type { ChartColorPalette } from './chart-color-palette-catalog';
import {
	CHART_COLOR_PALETTES,
	chartPaletteColors,
	findChartColorPalette,
} from './chart-color-palette-catalog';
import { swatchStripSvg } from './chart-gallery-tiles';
import type { RibbonGalleryModule } from './gallery-module';
import { galleryColorScheme } from './gallery-theme';
import type { RibbonGalleryContext, RibbonGalleryItem } from './gallery-types';

const TILE = { width: 96, height: 14 };

function chartDataOf(element: PptxElement | null): PptxChartData | undefined {
	return element?.type === 'chart' ? element.chartData : undefined;
}

/** Charts that colour by category rather than by series. */
function coloursByPoint(chartData: PptxChartData): boolean {
	return Boolean(chartData.varyColors) && chartData.series.length <= 1;
}

/** `chartData` recoloured with `palette` under the deck's colour scheme. */
export function applyChartColorPalette(
	chartData: PptxChartData,
	palette: ChartColorPalette,
	ctx: RibbonGalleryContext,
): PptxChartData {
	const scheme = galleryColorScheme(ctx);
	const cleared = chartData.series.map(clearSeriesColor);
	if (coloursByPoint(chartData)) {
		const count = Math.max(chartData.categories.length, 1);
		return {
			...chartData,
			series: cleared,
			colorPalette: chartPaletteColors(palette, count, scheme),
			colorMethod: 'cycle',
		};
	}
	const colors = chartPaletteColors(palette, cleared.length, scheme);
	const base =
		palette.meth === 'withinLinear'
			? [chartPaletteColors(palette, 1, scheme)[0]]
			: palette.meth === 'cycle'
				? chartPaletteColors(palette, Math.max(palette.base.length, colors.length), scheme)
				: colors;
	return {
		...chartData,
		series: cleared.map((series, i) => ({ ...series, color: colors[i] })),
		colorPalette: base.length ? base : colors,
		colorMethod: palette.meth === 'withinLinear' ? 'withinLinear' : 'cycle',
	};
}

/** The palette whose per-series colours the chart currently shows, if any. */
function appliedPaletteId(chartData: PptxChartData, ctx: RibbonGalleryContext): number | undefined {
	const scheme = galleryColorScheme(ctx);
	const byPoint = coloursByPoint(chartData);
	const current = byPoint
		? chartData.colorPalette
		: chartData.series.map((series) => series.color?.toUpperCase());
	if (!current?.length || current.some((color) => !color)) {
		return undefined;
	}
	return CHART_COLOR_PALETTES.find((palette) => {
		const expected = chartPaletteColors(palette, current.length, scheme);
		return expected.every((color, i) => color === current[i]?.toUpperCase());
	})?.id;
}

function item(
	palette: ChartColorPalette,
	ctx: RibbonGalleryContext,
	appliedId: number | undefined,
): RibbonGalleryItem {
	const scheme = galleryColorScheme(ctx);
	const count = palette.group === 'colorful' ? Math.max(palette.base.length, 6) : 6;
	const label =
		palette.group === 'colorful'
			? `Colorful Palette ${palette.index}`
			: `Monochromatic Palette ${palette.index}`;
	return {
		id: String(palette.id),
		labelKey: `pptx.gallery.chartColors.${palette.group}`,
		labelParams: { n: palette.index },
		label,
		previewSvg: swatchStripSvg(chartPaletteColors(palette, count, scheme), TILE),
		applied: appliedId === palette.id,
	};
}

export const CHART_COLORS_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const chartData = chartDataOf(ctx.element);
		const appliedId = chartData ? appliedPaletteId(chartData, ctx) : undefined;
		const section = (group: ChartColorPalette['group'], title: string) => ({
			id: group,
			titleKey: `pptx.gallery.chartColors.section.${group}`,
			title,
			columns: 1,
			tileWidth: TILE.width,
			tileHeight: TILE.height,
			items: CHART_COLOR_PALETTES.filter((palette) => palette.group === group).map((palette) =>
				item(palette, ctx, appliedId),
			),
		});
		return {
			id: 'chartColors',
			labelKey: 'pptx.gallery.chartColors.title',
			label: 'Change Colors',
			disabled: !chartData || chartData.series.length === 0,
			sections: [section('colorful', 'Colorful'), section('monochromatic', 'Monochromatic')],
		};
	},
	apply(itemId, ctx) {
		const element = ctx.element;
		const chartData = chartDataOf(element);
		const palette = findChartColorPalette(Number(itemId));
		if (!element || !chartData || !palette || chartData.series.length === 0) {
			return null;
		}
		return {
			kind: 'element',
			elementId: element.id,
			patch: {
				chartData: applyChartColorPalette(chartData, palette, ctx),
			} as Partial<PptxElement>,
		};
	},
};
