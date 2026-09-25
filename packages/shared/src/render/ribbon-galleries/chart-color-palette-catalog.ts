/**
 * PowerPoint's Chart Design > Change Colors palettes, and how PowerPoint
 * turns one into per-series colours.
 *
 * Ground truth: `scripts/capture-data-galleries-com.ps1` sets
 * `Chart.ChartColor = 10..26` on a clustered column chart and saves; each
 * chart's `colorsN.xml` is the `cs:colorStyle` below (id, `meth`, base scheme
 * colours, `cs:variation` list) and each `c:ser/c:spPr` the colour PowerPoint
 * derived from it. Two derivations exist:
 *
 * - `cycle`: series i takes base colour `i mod len`, transformed by variation
 *   `floor(i / len)` (variation 0 of the colourful palettes is "none").
 * - `withinLinear` (and `withinLinearReversed`): one base colour spread from a
 *   shade to a tint. Measured for 2..10 series (ChartColor 14 over 2, 3, 4,
 *   5, 6, 7, 8 and 10 series):
 *   the step is `140 / (n + 1)` percent, series at distance d from the centre
 *   get `100 - step * d`, written as `a:shade` (rounded down) before the
 *   centre and `a:tint` (rounded up) after it, the centre (odd n) untouched.
 *   Four series give shade 58000, shade 86000, tint 86000, tint 58000.
 *
 * @module render/ribbon-galleries/chart-color-palette-catalog
 */
import type { PptxThemeColorScheme, XmlObject } from 'pptx-viewer-core';

import { parseDrawingColorChoice } from '../drawing-color';

type Transform = Readonly<Partial<Record<'lumMod' | 'lumOff' | 'tint' | 'shade', number>>>;

export interface ChartColorPalette {
	/** `Chart.ChartColor` / `cs:colorStyle/@id`. */
	id: number;
	group: 'colorful' | 'monochromatic';
	/** 1-based number within its group ("Colorful Palette 3"). */
	index: number;
	meth: 'cycle' | 'withinLinear' | 'withinLinearReversed';
	base: ReadonlyArray<keyof PptxThemeColorScheme>;
	variations: readonly Transform[];
}

/** The colourful palettes' shared variation list (colors1.xml, id 10). */
const COLORFUL_VARIATIONS: readonly Transform[] = [
	{},
	{ lumMod: 60000 },
	{ lumMod: 80000, lumOff: 20000 },
	{ lumMod: 80000 },
	{ lumMod: 60000, lumOff: 40000 },
	{ lumMod: 50000 },
	{ lumMod: 70000, lumOff: 30000 },
	{ lumMod: 70000 },
	{ lumMod: 50000, lumOff: 50000 },
];

/** id 20's dk1 variation list (colors11.xml). */
const GRAY_VARIATIONS: readonly Transform[] = [
	{ tint: 88500 },
	{ tint: 55000 },
	{ tint: 75000 },
	{ tint: 98500 },
	{ tint: 30000 },
	{ tint: 60000 },
	{ tint: 80000 },
];

const ACCENTS = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;

function colorful(id: number, index: number, base: ChartColorPalette['base']): ChartColorPalette {
	return { id, group: 'colorful', index, meth: 'cycle', base, variations: COLORFUL_VARIATIONS };
}

function mono(
	id: number,
	index: number,
	accent: keyof PptxThemeColorScheme,
	meth: ChartColorPalette['meth'],
): ChartColorPalette {
	return { id, group: 'monochromatic', index, meth, base: [accent], variations: [] };
}

export const CHART_COLOR_PALETTES: readonly ChartColorPalette[] = [
	colorful(10, 1, ACCENTS),
	colorful(11, 2, ['accent1', 'accent3', 'accent5']),
	colorful(12, 3, ['accent2', 'accent4', 'accent6']),
	colorful(13, 4, ['accent6', 'accent5', 'accent4']),
	...ACCENTS.map((accent, i) => mono(14 + i, 1 + i, accent, 'withinLinear')),
	{
		id: 20,
		group: 'monochromatic',
		index: 7,
		meth: 'cycle',
		base: ['dk1'],
		variations: GRAY_VARIATIONS,
	},
	...ACCENTS.map((accent, i) => mono(21 + i, 8 + i, accent, 'withinLinearReversed')),
];

export function findChartColorPalette(id: number): ChartColorPalette | undefined {
	return CHART_COLOR_PALETTES.find((palette) => palette.id === id);
}

const toLinear = (c: number): number => {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (l: number): number => {
	const s = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

/**
 * `a:shade` / `a:tint` as PowerPoint applies them: in LINEAR light (measured:
 * accent2 #E97132 shade 58% reads back #B75725, tint 58% #F3BEB1), not by
 * mixing the gamma-encoded channels.
 */
function shadeTintLinear(hex: string, transform: Transform): string {
	const channels = [1, 3, 5].map((i) => toLinear(Number.parseInt(hex.slice(i, i + 2), 16)));
	const out = channels.map((l) => {
		let v = l;
		if (transform.shade !== undefined) {
			v *= transform.shade / 100000;
		}
		if (transform.tint !== undefined) {
			v = 1 - (1 - v) * (transform.tint / 100000);
		}
		return toSrgb(v).toString(16).padStart(2, '0');
	});
	return `#${out.join('')}`.toUpperCase();
}

function resolve(
	scheme: PptxThemeColorScheme,
	key: keyof PptxThemeColorScheme,
	transform: Transform,
): string {
	if (transform.shade !== undefined || transform.tint !== undefined) {
		return shadeTintLinear(scheme[key], transform);
	}
	const node: XmlObject = { '@_val': key };
	for (const [name, value] of Object.entries(transform)) {
		node[`a:${name}`] = { '@_val': String(value) };
	}
	const overrides = { ...scheme } as Record<string, string | undefined>;
	return (parseDrawingColorChoice({ 'a:schemeClr': node }, overrides) ?? scheme[key]).toUpperCase();
}

/** The `a:shade` / `a:tint` PowerPoint writes for series `i` of `n` (withinLinear order). */
export function withinLinearTransform(i: number, n: number): Transform {
	if (n <= 1) {
		return {};
	}
	const step = 140 / (n + 1);
	const centre = (n - 1) / 2;
	const value = 100 - step * Math.abs(i - centre);
	if (i < centre) {
		return { shade: Math.floor(value + 1e-9) * 1000 };
	}
	if (i > centre) {
		return { tint: Math.ceil(value - 1e-9) * 1000 };
	}
	return {};
}

/** The colour of series `i` of `n` under `palette`, in the deck's theme. */
export function chartPaletteSeriesColor(
	palette: ChartColorPalette,
	i: number,
	n: number,
	scheme: PptxThemeColorScheme,
): string {
	if (palette.meth === 'cycle') {
		const base = palette.base[i % palette.base.length];
		const round = Math.floor(i / palette.base.length);
		const transform = palette.variations.length
			? palette.variations[round % palette.variations.length]
			: {};
		return resolve(scheme, base, transform);
	}
	const index = palette.meth === 'withinLinearReversed' ? n - 1 - i : i;
	return resolve(scheme, palette.base[0], withinLinearTransform(index, n));
}

/** The first `n` colours of `palette`. */
export function chartPaletteColors(
	palette: ChartColorPalette,
	n: number,
	scheme: PptxThemeColorScheme,
): string[] {
	return Array.from({ length: n }, (_, i) => chartPaletteSeriesColor(palette, i, n, scheme));
}
