/**
 * chart-quick-action-styles.ts: PowerPoint's "Chart Styles" quick-action
 * gallery (the paintbrush icon shown outside a selected chart), a one-click
 * recolour of the whole chart.
 *
 * No preset/gallery model existed anywhere in this codebase before this
 * module: `chart-style-defaults.ts` only resolves font/colour FALLBACKS from
 * a chart's own parsed `chartStyleDefinition` part, and `chart-helpers.ts`'s
 * `getChartStylePalette(styleId)` (1-48) generates the 2D chart engine's
 * built-in style palettes, but nothing curated a small user-facing subset of
 * them or applied one to a chart. This module is deliberately modest (six
 * presets) rather than PowerPoint's full 48+ gallery, per this feature's
 * scope: it reuses `getChartStylePalette` for every colour, not a new colour
 * model.
 *
 * The 2D SVG chart engine (`chart-view-model-scale.ts`'s `seriesColor`/
 * `paletteColor`) reads `PptxChartData.colorPalette` directly and does NOT
 * consult `style.styleId` (that field only feeds the separate 3-D chart
 * engine's palette resolution, see `chart-view-model.ts`'s header comment).
 * So {@link applyChartStylePreset} writes the resolved palette straight onto
 * `colorPalette` (which the doc comment on that field already says takes
 * priority over the styleId-derived one), and also mirrors `style.styleId`
 * so the 3-D engine and the "which preset is applied" check stay consistent.
 * A series' own explicit `color` override (set via the per-series colour
 * picker) still wins over the palette, exactly as it does today: applying a
 * style preset does not clear per-series overrides, matching PowerPoint's own
 * "Change Colors" behaviour.
 *
 * @module render/chart-quick-action-styles
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { getChartStylePalette } from './chart-helpers';

/** One built-in "Chart Styles" gallery entry. */
export interface ChartStylePresetDescriptor {
	id: string;
	labelKey: string;
	/** Resolved swatch colours (for the gallery thumbnail), in series order. */
	colors: readonly string[];
	/** Whether this preset's palette matches the chart's current `colorPalette`. */
	applied: boolean;
}

/** The curated preset list: (id, label key, source `c:style/@val`). */
const CHART_STYLE_PRESETS: ReadonlyArray<{ id: string; labelKey: string; styleId: number }> = [
	{ id: 'colorful', labelKey: 'pptx.chart.styleColorful', styleId: 2 },
	{ id: 'monochrome', labelKey: 'pptx.chart.styleMonochrome', styleId: 10 },
	{ id: 'colorfulLight', labelKey: 'pptx.chart.styleColorfulLight', styleId: 18 },
	{ id: 'colorfulDark', labelKey: 'pptx.chart.styleColorfulDark', styleId: 26 },
	{ id: 'mutedDark', labelKey: 'pptx.chart.styleMutedDark', styleId: 34 },
	{ id: 'pastel', labelKey: 'pptx.chart.stylePastel', styleId: 42 },
];

function paletteEquals(a: readonly string[], b: readonly string[] | undefined): boolean {
	if (!b || a.length !== b.length) {
		return false;
	}
	return a.every((c, i) => c.toLowerCase() === b[i]?.toLowerCase());
}

/** Resolve the id -> styleId map entry, or `undefined` for an unknown id. */
function findPreset(id: string) {
	return CHART_STYLE_PRESETS.find((p) => p.id === id);
}

/**
 * Build the "Chart Styles" gallery descriptor for the currently-selected
 * chart: every preset's resolved colours plus whether it is the one
 * currently applied (its resolved palette matches `chartData.colorPalette`).
 */
export function buildChartStylePresets(
	chartData: Pick<PptxChartData, 'colorPalette'>,
): ChartStylePresetDescriptor[] {
	return CHART_STYLE_PRESETS.map(({ id, labelKey, styleId }) => {
		const colors = getChartStylePalette(styleId);
		return {
			id,
			labelKey,
			colors,
			applied: paletteEquals(colors, chartData.colorPalette),
		};
	});
}

/**
 * Apply a "Chart Styles" preset by id: resolves its palette via
 * `getChartStylePalette` and writes it onto `colorPalette` (also mirroring
 * `style.styleId`, see this module's header). Returns `null` for an unknown
 * preset id so a caller can no-op instead of silently clearing the chart's
 * palette.
 */
export function applyChartStylePreset(
	chartData: PptxChartData,
	presetId: string,
): PptxChartData | null {
	const preset = findPreset(presetId);
	if (!preset) {
		return null;
	}
	const colors = [...getChartStylePalette(preset.styleId)];
	return {
		...chartData,
		colorPalette: colors,
		style: { ...chartData.style, styleId: preset.styleId },
	};
}
