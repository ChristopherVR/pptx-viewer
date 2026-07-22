/**
 * table-style-fill.ts — resolve and apply table-style section fills / text.
 *
 * Issue #95: the band-style helper previously handled only scheme-colour solid
 * fills. This module resolves the broadened {@link ParsedTableStyleFill}
 * (scheme + explicit sRGB solids, gradients, preset patterns, and `a:noFill`)
 * and the broadened {@link ParsedTableStyleText} (underline, typeface, sRGB
 * font colour) onto a framework-agnostic CSS object.
 *
 * Colour math (tint/shade blending) and gradient/pattern CSS assembly reuse the
 * shared {@link buildGradientCss} / {@link getPatternSvg} helpers so the logic
 * is not hand-rolled per band role.
 */
import type {
	ParsedTableStyleFill,
	ParsedTableStyleGradientStop,
	ParsedTableStyleText,
	PptxTableCell3D,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	ShapeStyle,
} from 'pptx-viewer-core';

import { buildGradientCss, getPatternSvg, normalizeHexColor } from './fill-style';
import type { TableCellCss } from './table-style';

// ---------------------------------------------------------------------------
// Theme colour helpers (tint / shade) — mirrors React viewer/utils/theme.ts
// ---------------------------------------------------------------------------

/** Parse a 6-digit hex colour (`#RRGGBB` or `RRGGBB`) into RGB components. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace(/^#/u, '');
	return {
		r: parseInt(clean.substring(0, 2), 16),
		g: parseInt(clean.substring(2, 4), 16),
		b: parseInt(clean.substring(4, 6), 16),
	};
}

/** Convert RGB components back to a `#RRGGBB` string. */
function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
	return `#${clamp(r).toString(16).padStart(2, '0').toUpperCase()}${clamp(g).toString(16).padStart(2, '0').toUpperCase()}${clamp(b).toString(16).padStart(2, '0').toUpperCase()}`;
}

/** Compute a tinted (lighter) colour. `tintFactor` in 0-1 (1 = white). */
function tintColor(hex: string, tintFactor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHex(
		r + (255 - r) * tintFactor,
		g + (255 - g) * tintFactor,
		b + (255 - b) * tintFactor,
	);
}

/** Compute a shaded (darker) colour. `shadeFactor` in 0-1 (1 = black). */
function shadeColor(hex: string, shadeFactor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHex(r * (1 - shadeFactor), g * (1 - shadeFactor), b * (1 - shadeFactor));
}

/** Apply a fill's tint/shade to a resolved base hex colour. */
function applyTintShade(base: string, fill: ParsedTableStyleFill): string {
	let color = base;
	if (fill.tint !== undefined && fill.tint > 0) {
		color = tintColor(color, fill.tint / 100_000);
	}
	if (fill.shade !== undefined && fill.shade > 0) {
		color = shadeColor(color, 1 - fill.shade / 100_000);
	}
	return color;
}

/**
 * Resolve a {@link ParsedTableStyleFill} to a concrete CSS hex colour using the
 * supplied colour scheme. Honours a scheme colour first, then an explicit sRGB
 * `color`. Returns `undefined` when neither resolves (e.g. gradient/pattern/no
 * fill, or a scheme key absent from the theme).
 */
export function resolveStyleFillColor(
	fill: ParsedTableStyleFill | undefined,
	colorScheme: PptxThemeColorScheme | undefined,
): string | undefined {
	if (!fill) {
		return undefined;
	}
	let base: string | undefined;
	if (fill.schemeColor && colorScheme) {
		base = (colorScheme as unknown as Record<string, string | undefined>)[fill.schemeColor];
	}
	if (!base && fill.color) {
		base = fill.color;
	}
	if (!base) {
		return undefined;
	}
	return applyTintShade(base, fill);
}

/** Clear every background-related key so a higher layer replaces cleanly. */
function clearBackground(css: TableCellCss): void {
	delete css.background;
	delete css.backgroundColor;
	delete css.backgroundImage;
}

/** Build a CSS gradient string from a parsed table-style gradient fill. */
function gradientCssFromFill(
	fill: ParsedTableStyleFill,
	colorScheme: PptxThemeColorScheme | undefined,
): string | undefined {
	const gradient = fill.gradient;
	if (!gradient || gradient.stops.length === 0) {
		return undefined;
	}
	const shapeLike = {
		fillMode: 'gradient',
		fillGradientType: gradient.type,
		fillGradientAngle: gradient.angle ?? 90,
		fillGradientStops: gradient.stops.map((stop: ParsedTableStyleGradientStop) => ({
			color: resolveStyleFillColor(stop.fill, colorScheme) ?? stop.fill.color ?? '#000000',
			position: stop.position,
		})),
	} as ShapeStyle;
	return buildGradientCss(shapeLike);
}

/**
 * Apply a {@link ParsedTableStyleFill} onto a {@link TableCellCss} background.
 * Handles no-fill (transparent), gradient, preset pattern, and solid (scheme or
 * sRGB) fills. When the fill is absent or unresolvable, falls back to
 * `fallback` as a solid background colour. Returns `true` when anything was set.
 */
export function applyStyleFill(
	fill: ParsedTableStyleFill | undefined,
	colorScheme: PptxThemeColorScheme | undefined,
	css: TableCellCss,
	fallback?: string,
): boolean {
	if (fill?.noFill) {
		clearBackground(css);
		css.backgroundColor = 'transparent';
		return true;
	}

	if (fill?.gradient) {
		const gradientCss = gradientCssFromFill(fill, colorScheme);
		if (gradientCss) {
			clearBackground(css);
			css.background = gradientCss;
			return true;
		}
	}

	if (fill?.pattern) {
		const fg = normalizeHexColor(
			resolveStyleFillColor(fill.pattern.foreground, colorScheme),
			'#000000',
		);
		const bg = normalizeHexColor(
			resolveStyleFillColor(fill.pattern.background, colorScheme),
			'#ffffff',
		);
		const svg = getPatternSvg(fill.pattern.preset, fg, bg);
		clearBackground(css);
		if (svg) {
			css.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
		}
		css.backgroundColor = bg;
		return true;
	}

	const color = resolveStyleFillColor(fill, colorScheme) ?? fallback;
	if (color) {
		clearBackground(css);
		css.backgroundColor = color;
		return true;
	}
	return false;
}

/**
 * Resolve a table-style `a:fontRef@idx` collection index to a concrete font
 * family via the theme font scheme. `minor` maps to the body font, `major` to
 * the heading font; `none` (or an absent scheme) resolves to `undefined`.
 */
export function resolveFontRefIdx(
	idx: string | undefined,
	fontScheme: PptxThemeFontScheme | undefined,
): string | undefined {
	if (!idx || !fontScheme) {
		return undefined;
	}
	if (idx === 'minor') {
		return fontScheme.minorFont?.latin;
	}
	if (idx === 'major') {
		return fontScheme.majorFont?.latin;
	}
	return undefined;
}

/**
 * Apply text properties from a {@link ParsedTableStyleText} entry into a
 * {@link TableCellCss} object. Returns `true` when any property was set.
 *
 * When `fontScheme` is supplied, a `fontRefIdx` (`minor`/`major`) resolves to
 * the theme body/heading font family; an explicit `fontFace` still wins.
 */
export function applyStyleText(
	text: ParsedTableStyleText | undefined,
	colorScheme: PptxThemeColorScheme | undefined,
	css: TableCellCss,
	fontScheme?: PptxThemeFontScheme,
): boolean {
	if (!text) {
		return false;
	}
	let applied = false;
	if (text.bold) {
		css.fontWeight = 700;
		applied = true;
	}
	if (text.italic) {
		css.fontStyle = 'italic';
		applied = true;
	}
	if (text.underline) {
		css.textDecorationLine = 'underline';
		applied = true;
	}
	if (text.fontFace) {
		css.fontFamily = text.fontFace;
		applied = true;
	} else {
		const refFont = resolveFontRefIdx(text.fontRefIdx, fontScheme);
		if (refFont) {
			css.fontFamily = refFont;
			applied = true;
		}
	}
	if (text.fontSchemeColor && colorScheme) {
		const base = (colorScheme as unknown as Record<string, string | undefined>)[
			text.fontSchemeColor
		];
		if (base) {
			let color = base;
			if (text.fontTint !== undefined && text.fontTint > 0) {
				color = tintColor(color, text.fontTint / 100_000);
			}
			if (text.fontShade !== undefined && text.fontShade > 0) {
				color = shadeColor(color, 1 - text.fontShade / 100_000);
			}
			css.color = color;
			applied = true;
		}
	} else if (text.fontColor) {
		css.color = text.fontColor;
		applied = true;
	}
	return applied;
}

/**
 * Highlight-offset sign per `a:lightRig@dir`. The bevel highlight sits on the
 * lit edges; the shadow mirrors it on the opposite edges. Keys are the eight
 * OOXML rig directions; the default (`tl`) lights the top-left.
 */
const BEVEL_LIGHT_OFFSETS: Record<string, { x: number; y: number }> = {
	tl: { x: 1, y: 1 },
	t: { x: 0, y: 1 },
	tr: { x: -1, y: 1 },
	r: { x: -1, y: 0 },
	br: { x: -1, y: -1 },
	b: { x: 0, y: -1 },
	bl: { x: 1, y: -1 },
	l: { x: 1, y: 0 },
};

/**
 * Build a CSS bevel treatment for a table cell's `a:cell3D` (CT_Cell3D). Uses a
 * pair of inset box-shadows: a light highlight on the lit edges and a dark
 * shadow on the opposite edges, sized from the bevel height/width.
 */
export function cell3DBevelCss(cell3D: PptxTableCell3D): TableCellCss {
	const size = Math.max(cell3D.bevelHeight ?? cell3D.bevelWidth ?? 4, 1);
	const dir = cell3D.lightRigDirection ?? 'tl';
	const off = BEVEL_LIGHT_OFFSETS[dir] ?? BEVEL_LIGHT_OFFSETS.tl;
	const highlight = `inset ${off.x * size}px ${off.y * size}px ${size}px rgba(255,255,255,0.55)`;
	const shadow = `inset ${-off.x * size}px ${-off.y * size}px ${size}px rgba(0,0,0,0.4)`;
	return { boxShadow: `${highlight}, ${shadow}` };
}
