import type {
	PptxChartData,
	PptxChartSeries,
	PptxChartStyle,
	PptxChartAxisFormatting,
} from 'pptx-viewer-core';

/**
 * Framework-agnostic chart helpers, a focused Vue port of the React package's
 * `viewer/utils/chart-helpers.ts`, `chart-layout.ts`, and
 * `chart-style-palettes.ts`.
 *
 * This module only covers the common-type renderers (bar / column / stacked /
 * line / area / pie / doughnut) and the shared chrome. Advanced axis/overlay
 * features (log axes, secondary axes, display units, trendlines, error bars,
 * data tables) live in `chart-axis.ts` / `chart-axis-render.ts` /
 * `chart-cartesian.ts` and are consumed via `chart/ChartViewModelSvg.vue`.
 *
 * These small pure helpers are an extraction candidate: long-term they (and
 * their React counterparts) should live in a shared, framework-agnostic
 * package so all three UI bindings reuse one implementation.
 */

// ── Style palettes ───────────────────────────────────────────────

const ACCENT1 = '#4472C4';
const ACCENT2 = '#ED7D31';
const ACCENT3 = '#A5A5A5';
const ACCENT4 = '#FFC000';
const ACCENT5 = '#5B9BD5';
const ACCENT6 = '#70AD47';

const ACCENTS = [ACCENT1, ACCENT2, ACCENT3, ACCENT4, ACCENT5, ACCENT6];

/** The default fallback palette used when no chart style is specified. */
export const DEFAULT_CHART_PALETTE: ReadonlyArray<string> = [
	'#3b82f6',
	'#22c55e',
	'#f97316',
	'#eab308',
	'#a855f7',
	'#ec4899',
	'#14b8a6',
	'#f43f5e',
];

/** Parse a hex colour string (#RRGGBB) into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.substring(0, 2), 16),
		parseInt(h.substring(2, 4), 16),
		parseInt(h.substring(4, 6), 16),
	];
}

/** Convert [r, g, b] back to #RRGGBB. */
function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
	return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
		.toString(16)
		.padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/** Apply a tint (lighten towards white). `amount` in [0, 1]. */
function tint(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Apply a shade (darken towards black). `amount` in [0, 1]. */
function shade(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function colorfulSequential(offset: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < 8; i++) {
		out.push(ACCENTS[(i + offset) % ACCENTS.length]);
	}
	return out;
}

function monochromaticRamp(base: string): string[] {
	return [
		shade(base, 0.5),
		shade(base, 0.35),
		shade(base, 0.15),
		base,
		tint(base, 0.2),
		tint(base, 0.4),
		tint(base, 0.6),
		tint(base, 0.8),
	];
}

function colorfulVariant(offset: number, tintAmount: number): string[] {
	return ACCENTS.map((_, i) => {
		const idx = (i + offset) % ACCENTS.length;
		return tintAmount > 0 ? tint(ACCENTS[idx], tintAmount) : shade(ACCENTS[idx], -tintAmount);
	}).concat([
		tint(ACCENTS[offset % ACCENTS.length], 0.4),
		shade(ACCENTS[(offset + 1) % ACCENTS.length], 0.2),
	]);
}

function darkPalette(offset: number, shadeAmount: number): string[] {
	return colorfulSequential(offset).map((c) => shade(c, shadeAmount));
}

function tonedPalette(offset: number, tintAmount: number): string[] {
	return colorfulSequential(offset).map((c) => tint(c, tintAmount));
}

function buildPalette(styleId: number): string[] {
	const id = Math.max(1, Math.min(48, styleId));
	if (id <= 8) {
		return colorfulSequential(id - 1);
	}
	if (id <= 16) {
		const accentIdx = (id - 9) % ACCENTS.length;
		return monochromaticRamp(ACCENTS[accentIdx]);
	}
	if (id <= 24) {
		const sub = id - 17;
		const tintAmt = sub < 4 ? sub * 0.1 : -(sub - 4) * 0.1;
		return colorfulVariant(sub, tintAmt);
	}
	if (id <= 32) {
		const sub = id - 25;
		return darkPalette(sub, 0.25 + (sub % 4) * 0.1);
	}
	if (id <= 40) {
		const sub = id - 33;
		return tonedPalette(sub, 0.15 + (sub % 4) * 0.08);
	}
	const sub = id - 41;
	return tonedPalette(sub, 0.4 + (sub % 4) * 0.1);
}

const paletteCache = new Map<number, string[]>();

/**
 * Get the colour palette for a chart style index (1–48). Falls back to the
 * default palette when undefined or out of range.
 */
export function getChartStylePalette(styleId?: number): ReadonlyArray<string> {
	if (styleId === undefined || styleId < 1 || styleId > 48) {
		return DEFAULT_CHART_PALETTE;
	}
	let palette = paletteCache.get(styleId);
	if (!palette) {
		palette = buildPalette(styleId);
		paletteCache.set(styleId, palette);
	}
	return palette;
}

/** Resolve a series colour: explicit colour → parsed palette → style palette. */
export function seriesColor(
	series: PptxChartSeries,
	index: number,
	styleId?: number,
	colorPalette?: string[],
): string {
	if (series.color) {
		return series.color;
	}
	if (colorPalette && colorPalette.length > 0) {
		return colorPalette[index % colorPalette.length];
	}
	const palette = getChartStylePalette(styleId);
	return palette[index % palette.length];
}

/** Palette colour for an index with no series object (e.g. per-slice pie colouring). */
export function paletteColor(index: number, styleId?: number, colorPalette?: string[]): string {
	if (colorPalette && colorPalette.length > 0) {
		return colorPalette[index % colorPalette.length];
	}
	const palette = getChartStylePalette(styleId);
	return palette[index % palette.length];
}

// ── Value range ──────────────────────────────────────────────────

export interface ValueRange {
	min: number;
	max: number;
	span: number;
	/** When true, the range represents log-scaled values (see `chart-axis.ts`). */
	logScale?: boolean;
	/** Logarithmic base (e.g. 10, 2, Math.E). Only meaningful when logScale is true. */
	logBase?: number;
	/** Whether values increase from top to bottom (`c:orientation="maxMin"`). */
	reverseOrder?: boolean;
}

/** Compute a Y-axis range that always includes zero. */
export function computeValueRange(series: ReadonlyArray<PptxChartSeries>): ValueRange {
	const allValues = series.flatMap((s) => s.values);
	if (allValues.length === 0) {
		return { min: 0, max: 1, span: 1 };
	}
	const dataMin = Math.min(...allValues);
	const dataMax = Math.max(...allValues);
	const min = Math.min(dataMin, 0);
	const max = Math.max(dataMax, 0);
	const span = Math.max(max - min, 1);
	return { min, max, span };
}

/**
 * Map a data value to a Y pixel coordinate (top = max, bottom = min).
 * Routes through logarithmic scaling when `range.logScale` is set (the log
 * helpers live in `chart-axis.ts`; the branch is inlined here to avoid a
 * circular import).
 */
export function valueToY(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	let ratio: number;
	if (range.logScale && range.logBase) {
		const base = range.logBase;
		const clampedVal = Math.max(val, range.min);
		const logVal = Math.log(clampedVal) / Math.log(base);
		const logMin = Math.log(range.min) / Math.log(base);
		ratio = (logVal - logMin) / range.span;
	} else {
		ratio = (val - range.min) / range.span;
	}
	return range.reverseOrder ? topY + ratio * usable : bottomY - ratio * usable;
}

/** Compact axis-value formatting (1.2K / 3.4M / integer / one-decimal). */
export function formatAxisValue(val: number): string {
	if (Math.abs(val) >= 1_000_000) {
		return `${(val / 1_000_000).toFixed(1)}M`;
	}
	if (Math.abs(val) >= 1_000) {
		return `${(val / 1_000).toFixed(1)}K`;
	}
	if (Number.isInteger(val)) {
		return String(val);
	}
	return val.toFixed(1);
}

// ── Layout ───────────────────────────────────────────────────────

export interface PlotLayout {
	plotLeft: number;
	plotTop: number;
	plotRight: number;
	plotBottom: number;
	plotWidth: number;
	plotHeight: number;
	svgWidth: number;
	svgHeight: number;
}

/**
 * Reserved-space options for `computeLayout` (secondary axes + data table).
 * Structurally identical to `LayoutOptions` in `chart-axis.ts`; declared here
 * as a plain shape to avoid a circular import (chart-axis depends on this file).
 */
export interface ComputeLayoutOptions {
	hasSecondaryValueAxis?: boolean;
	hasSecondaryCategoryAxis?: boolean;
	hasDataTable?: boolean;
	dataTableRowCount?: number;
}

/**
 * Compute the plot rectangle within the SVG, reserving room for axes, title,
 * legend, optional secondary axes, and an optional data table.
 */
export function computeLayout(
	elementWidth: number,
	elementHeight: number,
	style: PptxChartStyle | undefined,
	hasAxes: boolean,
	legendPos: string,
	options?: ComputeLayoutOptions,
): PlotLayout {
	const svgWidth = Math.max(320, elementWidth);
	const svgHeight = Math.max(180, elementHeight);
	let plotLeft = hasAxes ? 48 : 8;
	let plotTop = 8;
	let plotRight = svgWidth - 8;
	let plotBottom = svgHeight - (hasAxes ? 24 : 8);

	if (style?.hasTitle) {
		plotTop += 20;
	}
	if (style?.hasLegend) {
		if (legendPos === 'b') {
			plotBottom -= 20;
		} else if (legendPos === 't') {
			plotTop += 20;
		} else if (legendPos === 'r') {
			plotRight -= 80;
		} else if (legendPos === 'l') {
			plotLeft += 80;
		}
	}

	// Reserve space for a secondary value axis on the right.
	if (options?.hasSecondaryValueAxis) {
		plotRight -= 40;
	}
	// Reserve space for a secondary category axis on the top.
	if (options?.hasSecondaryCategoryAxis) {
		plotTop += 16;
	}
	// Reserve space for a data table below the chart.
	if (options?.hasDataTable) {
		const rowCount = options.dataTableRowCount ?? 1;
		plotBottom -= 14 + rowCount * 14;
	}

	const pw = Math.max(plotRight - plotLeft, 1);
	const ph = Math.max(plotBottom - plotTop, 1);
	return {
		plotLeft,
		plotTop,
		plotRight: plotLeft + pw,
		plotBottom: plotTop + ph,
		plotWidth: pw,
		plotHeight: ph,
		svgWidth,
		svgHeight,
	};
}

// ── Derived helpers ──────────────────────────────────────────────

/** Find the primary value-axis formatting (non-right, or first valAx). */
export function getPrimaryValueAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	if (!axes) {
		return undefined;
	}
	return (
		axes.find((a) => a.axisType === 'valAx' && a.axPos !== 'r') ??
		axes.find((a) => a.axisType === 'valAx')
	);
}

/**
 * Resolve category labels for a chart: use the declared categories, otherwise
 * synthesise 1-based labels for the longest series.
 */
export function resolveCategoryLabels(chartData: PptxChartData): string[] {
	if (chartData.categories.length > 0) {
		return chartData.categories;
	}
	const longest = chartData.series.reduce((max, s) => Math.max(max, s.values.length), 0);
	return Array.from({ length: longest }, (_, i) => String(i + 1));
}
