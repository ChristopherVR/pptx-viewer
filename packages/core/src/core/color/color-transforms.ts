/**
 * OOXML drawing colour transforms — all 26 transform operations.
 *
 * Applies structural, shade/tint, HSL, and direct RGB channel transforms
 * to a base colour as specified in the OOXML spec (ECMA-376 Part 1, 20.1.2.3).
 *
 * The transforms are applied in a specific order to match PowerPoint's
 * rendering behaviour. Each transform reads its value from a child
 * element of the colour node (e.g. `<a:shade val="50000"/>`).
 *
 * @module color-transforms
 */

import type { XmlObject } from '../types';
import {
	clampUnitInterval,
	hexToRgbChannels,
	rgbToHsl,
	hslToRgb,
	toHex,
	parseDrawingPercent,
	parseDrawingFraction,
	parseDrawingHueDegrees,
} from './color-primitives';

// ---------------------------------------------------------------------------
// Colour transforms — all 26 OOXML drawing colour transforms
// ---------------------------------------------------------------------------

/**
 * Apply every OOXML colour transform found on {@link colorNode} to
 * {@link baseColor} and return the resulting `#RRGGBB` hex string.
 *
 * Transform application order (matches PowerPoint behaviour):
 *   1. Structural — `comp` (complement), `inv` (inverse), `gray` (greyscale)
 *   2. RGB-space mixing — `shade` (darken toward black), `tint` (lighten toward white)
 *   3. HSL transforms — `hue`/`hueMod`/`hueOff`, `sat`/`satMod`/`satOff`,
 *      `lum`/`lumMod`/`lumOff` (single RGB-to-HSL round-trip)
 *   4. Direct RGB channels — `red`/`redMod`/`redOff`, `green`/..., `blue`/...
 *
 * @param baseColor - The starting `#RRGGBB` hex colour string.
 * @param colorNode - The OOXML colour XML node containing transform child elements.
 * @returns The transformed `#RRGGBB` hex colour string.
 */
export function applyDrawingColorTransforms(baseColor: string, colorNode: XmlObject): string {
	const rgb = hexToRgbChannels(baseColor);
	if (!rgb) {
		return baseColor;
	}

	let r = rgb.r;
	let g = rgb.g;
	let b = rgb.b;

	/** Shorthand: read the `@_val` attribute from a child element. */
	const getVal = (key: string): unknown => (colorNode[key] as XmlObject | undefined)?.['@_val'];

	// ── 0. Gamma encode (`a:gamma`) ──────────────────────────────────────
	// ECMA-376 §20.1.2.3.8 — apply the standard sRGB gamma encoding
	// (linear → companded). Mirror element of `a:invGamma`.
	if (colorNode['a:gamma'] !== undefined) {
		const out = applySrgbGammaEncode(r, g, b);
		r = out.r;
		g = out.g;
		b = out.b;
	}

	// `a:invGamma` (ECMA-376 §20.1.2.3.16) — inverse gamma decoding
	// (companded → linear).  Applied here, before any transforms that
	// expect linear-space channels.
	if (colorNode['a:invGamma'] !== undefined) {
		const out = applySrgbGammaDecode(r, g, b);
		r = out.r;
		g = out.g;
		b = out.b;
	}

	// ── 1. Structural transforms ─────────────────────────────────────────

	// Complement: rotate hue by 180 degrees (opposite on the colour wheel)
	if (colorNode['a:comp'] !== undefined) {
		const hsl = rgbToHsl(r, g, b);
		hsl.h = (hsl.h + 180) % 360;
		const out = hslToRgb(hsl.h, hsl.s, hsl.l);
		r = out.r;
		g = out.g;
		b = out.b;
	}

	// Inverse: negate each RGB channel (255 - value)
	if (colorNode['a:inv'] !== undefined) {
		r = 255 - r;
		g = 255 - g;
		b = 255 - b;
	}

	// Greyscale: convert to luminance using ITU-R BT.601 coefficients
	if (colorNode['a:gray'] !== undefined) {
		const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
		r = gray;
		g = gray;
		b = gray;
	}

	// ── 2. Shade & tint (RGB-space mixing with black / white) ────────────

	// Shade: mix toward black by multiplying each channel by the shade fraction.
	// shade=0 → pure black, shade=1 → unchanged.
	const shade = parseDrawingPercent(getVal('a:shade'));
	if (shade !== undefined) {
		r *= shade;
		g *= shade;
		b *= shade;
	}

	// Tint: mix toward white by linear interpolation from current toward 255.
	// tint=0 → unchanged, tint=1 → pure white.
	const tint = parseDrawingPercent(getVal('a:tint'));
	if (tint !== undefined) {
		r += (255 - r) * tint;
		g += (255 - g) * tint;
		b += (255 - b) * tint;
	}

	// ── 3. HSL transforms (single conversion round-trip) ─────────────────
	// All HSL transforms are batched into a single RGB->HSL->RGB round-trip
	// to avoid cumulative rounding errors from multiple conversions.

	const hslKeys = [
		'a:hue',
		'a:hueMod',
		'a:hueOff',
		'a:sat',
		'a:satMod',
		'a:satOff',
		'a:lum',
		'a:lumMod',
		'a:lumOff',
	];
	const hasHsl = hslKeys.some((k) => colorNode[k] !== undefined);

	if (hasHsl) {
		const hsl = rgbToHsl(r, g, b);

		// Hue ─────────────────────────────────────────────────────────────
		const hueAbs = parseDrawingHueDegrees(getVal('a:hue'));
		if (hueAbs !== undefined) {
			hsl.h = ((hueAbs % 360) + 360) % 360;
		}
		const hueMod = parseDrawingFraction(getVal('a:hueMod'));
		if (hueMod !== undefined) {
			hsl.h = (((hsl.h * hueMod) % 360) + 360) % 360;
		}
		const hueOff = parseDrawingHueDegrees(getVal('a:hueOff'));
		if (hueOff !== undefined) {
			hsl.h = (((hsl.h + hueOff) % 360) + 360) % 360;
		}

		// Saturation ──────────────────────────────────────────────────────
		const satAbs = parseDrawingFraction(getVal('a:sat'));
		if (satAbs !== undefined) {
			hsl.s = clampUnitInterval(satAbs);
		}
		const satMod = parseDrawingFraction(getVal('a:satMod'));
		if (satMod !== undefined) {
			hsl.s = clampUnitInterval(hsl.s * satMod);
		}
		const satOff = parseDrawingFraction(getVal('a:satOff'));
		if (satOff !== undefined) {
			hsl.s = clampUnitInterval(hsl.s + satOff);
		}

		// Luminance ───────────────────────────────────────────────────────
		const lumAbs = parseDrawingFraction(getVal('a:lum'));
		if (lumAbs !== undefined) {
			hsl.l = clampUnitInterval(lumAbs);
		}
		const lumMod = parseDrawingFraction(getVal('a:lumMod'));
		if (lumMod !== undefined) {
			hsl.l = clampUnitInterval(hsl.l * lumMod);
		}
		const lumOff = parseDrawingFraction(getVal('a:lumOff'));
		if (lumOff !== undefined) {
			hsl.l = clampUnitInterval(hsl.l + lumOff);
		}

		const out = hslToRgb(hsl.h, hsl.s, hsl.l);
		r = out.r;
		g = out.g;
		b = out.b;
	}

	// ── 4. Direct RGB channel transforms ─────────────────────────────────

	// Red channel
	const redAbs = parseDrawingFraction(getVal('a:red'));
	if (redAbs !== undefined) {
		r = Math.round(clampUnitInterval(redAbs) * 255);
	}
	const redMod = parseDrawingFraction(getVal('a:redMod'));
	if (redMod !== undefined) {
		r = Math.min(255, Math.max(0, Math.round(r * redMod)));
	}
	const redOff = parseDrawingFraction(getVal('a:redOff'));
	if (redOff !== undefined) {
		r = Math.min(255, Math.max(0, Math.round(r + 255 * redOff)));
	}

	// Green channel
	const greenAbs = parseDrawingFraction(getVal('a:green'));
	if (greenAbs !== undefined) {
		g = Math.round(clampUnitInterval(greenAbs) * 255);
	}
	const greenMod = parseDrawingFraction(getVal('a:greenMod'));
	if (greenMod !== undefined) {
		g = Math.min(255, Math.max(0, Math.round(g * greenMod)));
	}
	const greenOff = parseDrawingFraction(getVal('a:greenOff'));
	if (greenOff !== undefined) {
		g = Math.min(255, Math.max(0, Math.round(g + 255 * greenOff)));
	}

	// Blue channel
	const blueAbs = parseDrawingFraction(getVal('a:blue'));
	if (blueAbs !== undefined) {
		b = Math.round(clampUnitInterval(blueAbs) * 255);
	}
	const blueMod = parseDrawingFraction(getVal('a:blueMod'));
	if (blueMod !== undefined) {
		b = Math.min(255, Math.max(0, Math.round(b * blueMod)));
	}
	const blueOff = parseDrawingFraction(getVal('a:blueOff'));
	if (blueOff !== undefined) {
		b = Math.min(255, Math.max(0, Math.round(b + 255 * blueOff)));
	}

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---------------------------------------------------------------------------
// sRGB gamma helpers (ECMA-376 §20.1.2.3.8 / §20.1.2.3.16)
// ---------------------------------------------------------------------------

/**
 * Encode a single channel from linear-space [0,255] to companded sRGB [0,255]
 * using the IEC 61966-2-1 transfer function.
 */
function srgbEncodeChannel(channel: number): number {
	const linear = Math.min(1, Math.max(0, channel / 255));
	const companded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
	return Math.min(255, Math.max(0, Math.round(companded * 255)));
}

/**
 * Decode a single channel from companded sRGB [0,255] to linear-space [0,255]
 * using the inverse IEC 61966-2-1 transfer function.
 */
function srgbDecodeChannel(channel: number): number {
	const companded = Math.min(1, Math.max(0, channel / 255));
	const linear = companded <= 0.04045 ? companded / 12.92 : ((companded + 0.055) / 1.055) ** 2.4;
	return Math.min(255, Math.max(0, Math.round(linear * 255)));
}

/** Apply sRGB gamma encoding (linear → companded) to all three channels. */
function applySrgbGammaEncode(
	r: number,
	g: number,
	b: number,
): { r: number; g: number; b: number } {
	return { r: srgbEncodeChannel(r), g: srgbEncodeChannel(g), b: srgbEncodeChannel(b) };
}

/** Apply sRGB inverse gamma decoding (companded → linear) to all three channels. */
function applySrgbGammaDecode(
	r: number,
	g: number,
	b: number,
): { r: number; g: number; b: number } {
	return { r: srgbDecodeChannel(r), g: srgbDecodeChannel(g), b: srgbDecodeChannel(b) };
}
