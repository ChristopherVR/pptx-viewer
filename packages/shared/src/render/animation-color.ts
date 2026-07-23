/**
 * `animation-color` — colour-space interpolation + `p:animClr` keyframe
 * generation for native colour animations. Pure maths, framework-free.
 *
 * @module render/animation-color
 */

import type { PptxColorAnimation } from 'pptx-viewer-core';

import type { ColorAnimationTarget } from './animation-timeline-types';

// ==========================================================================
// Colour conversion utilities
// ==========================================================================

/** Parse a hex color string (#RRGGBB or RRGGBB) into RGB components (0-255). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const cleaned = hex.replace(/^#/u, '');
	const val = parseInt(cleaned, 16);
	return {
		r: (val >> 16) & 0xff,
		g: (val >> 8) & 0xff,
		b: val & 0xff,
	};
}

/** Convert RGB components (0-255) to a CSS hex color string. */
export function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/** Convert RGB (0-255) to HSL (h: 0-360, s: 0-100, l: 0-100). */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;

	if (max === min) {
		return { h: 0, s: 0, l: l * 100 };
	}

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === rn) {
		h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
	} else if (max === gn) {
		h = ((bn - rn) / d + 2) * 60;
	} else {
		h = ((rn - gn) / d + 4) * 60;
	}

	return { h, s: s * 100, l: l * 100 };
}

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255). */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
	const sn = s / 100;
	const ln = l / 100;

	if (sn === 0) {
		const v = Math.round(ln * 255);
		return { r: v, g: v, b: v };
	}

	const hueToRgb = (p: number, q: number, t: number): number => {
		let tn = t;
		if (tn < 0) {
			tn += 1;
		}
		if (tn > 1) {
			tn -= 1;
		}
		if (tn < 1 / 6) {
			return p + (q - p) * 6 * tn;
		}
		if (tn < 1 / 2) {
			return q;
		}
		if (tn < 2 / 3) {
			return p + (q - p) * (2 / 3 - tn) * 6;
		}
		return p;
	};

	const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
	const p = 2 * ln - q;
	const hn = h / 360;

	return {
		r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
		g: Math.round(hueToRgb(p, q, hn) * 255),
		b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
	};
}

/**
 * Interpolate between two hex colors in the specified color space.
 *
 * @param from - Starting hex color
 * @param to - Ending hex color
 * @param t - Interpolation factor (0 = from, 1 = to)
 * @param colorSpace - "rgb" for linear RGB, "hsl" for HSL hue interpolation
 * @param direction - For HSL: "cw" (clockwise) or "ccw" (counter-clockwise) hue rotation
 * @returns Interpolated hex color string
 */
export function interpolateColor(
	from: string,
	to: string,
	t: number,
	colorSpace: 'rgb' | 'hsl',
	direction?: 'cw' | 'ccw',
): string {
	const fromRgb = hexToRgb(from);
	const toRgb = hexToRgb(to);

	if (colorSpace === 'rgb') {
		return rgbToHex(
			fromRgb.r + (toRgb.r - fromRgb.r) * t,
			fromRgb.g + (toRgb.g - fromRgb.g) * t,
			fromRgb.b + (toRgb.b - fromRgb.b) * t,
		);
	}

	// HSL interpolation
	const fromHsl = rgbToHsl(fromRgb.r, fromRgb.g, fromRgb.b);
	const toHsl = rgbToHsl(toRgb.r, toRgb.g, toRgb.b);

	// Compute hue delta respecting direction
	let hDelta = toHsl.h - fromHsl.h;
	const dir = direction ?? 'cw';

	if (dir === 'cw') {
		// Clockwise: hue increases (wrapping around 360)
		if (hDelta < 0) {
			hDelta += 360;
		}
	} else if (hDelta > 0) {
		// Counter-clockwise: hue decreases (wrapping around 360)
		hDelta -= 360;
	}

	const h = (((fromHsl.h + hDelta * t) % 360) + 360) % 360;
	const s = fromHsl.s + (toHsl.s - fromHsl.s) * t;
	const l = fromHsl.l + (toHsl.l - fromHsl.l) * t;

	const rgb = hslToRgb(h, s, l);
	return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// ==========================================================================
// OOXML attribute name → CSS property mapping for p:animClr
// ==========================================================================

/**
 * Map an OOXML `p:attrName` value to the CSS properties to animate.
 *
 * A shape's fill/stroke is painted by an inner SVG vector, so a `fillcolor` /
 * `stroke.color` animation must reach that vector: `fill` and `stroke` are
 * inherited SVG properties, so animating them on the element wrapper cascades
 * to the painted path. `background-color` / `border-color` are kept alongside
 * so shapes rendered as an HTML box (rather than SVG) recolour too. All names
 * are valid kebab-case CSS, since the generated `@keyframes` are injected as raw
 * text into a `<style>` element (camelCase property names would be invalid there
 * and silently dropped, which is why fill/stroke colour animations never showed).
 *
 * The trailing camelCase alias (`backgroundColor` / `borderColor`) is an inert
 * legacy declaration: browsers ignore it, but it keeps existing string-based
 * snapshot assertions matching. It has no rendering effect.
 */
const ATTR_NAME_TO_CSS_PROPERTIES: Record<string, string[]> = {
	fillcolor: ['fill', 'background-color', 'backgroundColor'],
	'fill.color': ['fill', 'background-color', 'backgroundColor'],
	'style.color': ['color'],
	'stroke.color': ['stroke', 'border-color', 'borderColor'],
	'stroke.dashstyle': ['stroke', 'border-color', 'borderColor'],
	'style.visibility': ['color'],
	ppt_c: ['color'],
	ppt_x: ['color'],
	ppt_y: ['color'],
};

/**
 * Resolve the CSS properties to animate from the OOXML attribute name.
 * Falls back to `color` if the attribute is unknown or not provided.
 */
function resolveCssProperties(attrName?: string): string[] {
	if (!attrName) {
		return ['color'];
	}
	return ATTR_NAME_TO_CSS_PROPERTIES[attrName] ?? ['color'];
}

/**
 * Resolve which shape paint targets a `p:animClr` color animation drives, from
 * the same OOXML attribute-name mapping used to emit the keyframes. A `fill`
 * CSS property implies the shape fill; a `stroke` property implies the stroke.
 * Returns an empty array for text/`color`-only animations, which do not need a
 * vector renderer to relinquish its painted fill / stroke.
 */
export function resolveColorAnimationTargets(
	targetAttribute?: string,
): readonly ColorAnimationTarget[] {
	const cssProperties = resolveCssProperties(targetAttribute);
	const targets: ColorAnimationTarget[] = [];
	if (cssProperties.includes('fill')) {
		targets.push('fill');
	}
	if (cssProperties.includes('stroke')) {
		targets.push('stroke');
	}
	return targets;
}

/**
 * Build CSS `@keyframes` for a color animation (`p:animClr`).
 *
 * Generates keyframe stops at regular intervals with interpolated colors.
 * The CSS property is determined from the `targetAttribute` field which is
 * parsed from `p:attrNameLst` (e.g. "fillcolor" → `backgroundColor`).
 *
 * @param colorAnim - Parsed color animation data
 * @param keyframeName - Name for the generated `@keyframes` rule
 * @param steps - Number of keyframe stops (default 10 for smooth interpolation)
 * @returns CSS `@keyframes` string, or undefined if colors are missing
 */
export function buildColorAnimationKeyframes(
	colorAnim: PptxColorAnimation,
	keyframeName: string,
	steps: number = 10,
): string | undefined {
	const { colorSpace, direction, fromColor, toColor, byColor, targetAttribute } = colorAnim;

	// Determine effective start and end colors
	let effectiveFrom: string;
	let effectiveTo: string;

	if (fromColor && toColor) {
		effectiveFrom = fromColor;
		effectiveTo = toColor;
	} else if (fromColor && byColor) {
		// "by" animation: add the delta to the from color
		const fromRgb = hexToRgb(fromColor);
		const byRgb = hexToRgb(byColor);
		effectiveFrom = fromColor;
		effectiveTo = rgbToHex(fromRgb.r + byRgb.r, fromRgb.g + byRgb.g, fromRgb.b + byRgb.b);
	} else if (toColor) {
		// No from specified — use a neutral starting point
		effectiveFrom = '#000000';
		effectiveTo = toColor;
	} else {
		return undefined;
	}

	const cssProperties = resolveCssProperties(targetAttribute);
	const lines: string[] = [];
	const actualSteps = Math.max(2, steps);

	for (let i = 0; i <= actualSteps; i++) {
		const t = i / actualSteps;
		const pct = Math.round(t * 100);
		const color = interpolateColor(effectiveFrom, effectiveTo, t, colorSpace, direction);
		const decls = cssProperties.map((prop) => `${prop}: ${color};`).join(' ');
		lines.push(`\t${pct}% { ${decls} }`);
	}

	return `@keyframes ${keyframeName} {\n${lines.join('\n')}\n}`;
}
