/**
 * table-style-fill-parse.ts — pure helpers for parsing a table style
 * section's fill and text styling.
 *
 * Extracted from {@link PptxHandlerRuntimeTableStyles} so the runtime mixin
 * stays within the file-size budget and the parse logic is directly
 * unit-testable. Broadens the previous scheme-only extraction (issue #95) to
 * cover explicit sRGB solids, gradients (`a:gradFill`), preset patterns
 * (`a:pattFill`), and `a:noFill` for section fills, plus underline, typeface
 * (`a:font`), font-collection index (`a:fontRef`), and sRGB font colour for
 * section text.
 *
 * The `a:fillRef` style-matrix reference is intentionally left unresolved: the
 * style matrix (theme `fmtScheme`) is not in scope here, so such fills fall
 * back to the theme accent (documented limitation).
 *
 * Colour math (tint/shade RGB blending, gradient CSS assembly) is deliberately
 * NOT done here: this module only captures the structured colour references
 * and the shared renderer resolves them against the active theme colour scheme.
 */
import type {
	ParsedTableStyleFill,
	ParsedTableStyleGradient,
	ParsedTableStyleGradientStop,
	ParsedTableStylePattern,
	ParsedTableStyleText,
	XmlObject,
} from '../../types';
import { parseSolidFillStyle } from './table-style-border-parse';

/** Normalise a raw sRGB hex value to a `#RRGGBB` CSS string. */
function toHex(raw: string | undefined): string | undefined {
	const hex = String(raw ?? '').trim();
	if (!hex) {
		return undefined;
	}
	return hex.startsWith('#') ? hex : `#${hex}`;
}

/**
 * Parse a colour-choice container (`a:solidFill`, `a:gs`, `a:fgClr`, ...) into
 * a {@link ParsedTableStyleFill}. Handles `a:schemeClr` (via the shared solid
 * parser) and `a:srgbClr`. Returns `undefined` when neither is present.
 */
function parseColorChoiceFill(node: XmlObject | undefined): ParsedTableStyleFill | undefined {
	if (!node) {
		return undefined;
	}
	const scheme = parseSolidFillStyle(node);
	if (scheme) {
		return scheme;
	}
	const srgb = node['a:srgbClr'] as XmlObject | undefined;
	const color = toHex(srgb?.['@_val']);
	if (!color) {
		return undefined;
	}
	const fill: ParsedTableStyleFill = { schemeColor: '', color };
	const tintRaw = srgb?.['a:tint'] as XmlObject | undefined;
	const tint = tintRaw ? parseInt(String(tintRaw['@_val'] || '0'), 10) || undefined : undefined;
	if (tint !== undefined) {
		fill.tint = tint;
	}
	const shadeRaw = srgb?.['a:shade'] as XmlObject | undefined;
	const shade = shadeRaw ? parseInt(String(shadeRaw['@_val'] || '0'), 10) || undefined : undefined;
	if (shade !== undefined) {
		fill.shade = shade;
	}
	return fill;
}

/** Parse an `a:gradFill` node into a structured gradient (colours + geometry). */
function parseGradientFill(gradFill: XmlObject): ParsedTableStyleGradient | undefined {
	const gsLst = gradFill['a:gsLst'] as XmlObject | undefined;
	const rawStops = gsLst?.['a:gs'];
	const gsNodes = (Array.isArray(rawStops) ? rawStops : rawStops ? [rawStops] : []) as XmlObject[];
	const stops: ParsedTableStyleGradientStop[] = [];
	for (const gs of gsNodes) {
		const fill = parseColorChoiceFill(gs);
		if (!fill) {
			continue;
		}
		// `a:gs@pos` is a positive fixed percentage in 1000ths (0-100 000).
		const position = (parseInt(String(gs['@_pos'] || '0'), 10) || 0) / 1000;
		stops.push({ position, fill });
	}
	if (stops.length === 0) {
		return undefined;
	}
	const lin = gradFill['a:lin'] as XmlObject | undefined;
	if (lin) {
		const angRaw = parseInt(String(lin['@_ang'] || '0'), 10) || 0;
		const angle = (((angRaw / 60000) % 360) + 360) % 360;
		return { stops, angle, type: 'linear' };
	}
	if (gradFill['a:path'] !== undefined) {
		return { stops, type: 'radial' };
	}
	return { stops, type: 'linear' };
}

/** Parse an `a:pattFill` node into a preset pattern (preset + fg/bg colours). */
function parsePatternFill(pattFill: XmlObject): ParsedTableStylePattern | undefined {
	const preset = String(pattFill['@_prst'] || '').trim();
	if (!preset) {
		return undefined;
	}
	const pattern: ParsedTableStylePattern = { preset };
	const foreground = parseColorChoiceFill(pattFill['a:fgClr'] as XmlObject | undefined);
	if (foreground) {
		pattern.foreground = foreground;
	}
	const background = parseColorChoiceFill(pattFill['a:bgClr'] as XmlObject | undefined);
	if (background) {
		pattern.background = background;
	}
	return pattern;
}

/**
 * Extract the fill of a table style section (`a:wholeTbl`, `a:band1H`,
 * `a:seCell`, ...) from its `a:tcStyle/a:fill` choice. Handles solid (scheme +
 * sRGB), gradient, pattern, and no-fill. Returns `undefined` when the section
 * defines no resolvable fill (including the unresolved `a:fillRef` case).
 */
export function parseTableStyleSectionFill(
	section: XmlObject | undefined,
): ParsedTableStyleFill | undefined {
	if (!section) {
		return undefined;
	}
	const tcStyle = section['a:tcStyle'] as XmlObject | undefined;
	const fillWrap = tcStyle?.['a:fill'] as XmlObject | undefined;
	if (!fillWrap) {
		// `a:fillRef` style-matrix references are not resolvable here.
		return undefined;
	}
	if (fillWrap['a:noFill'] !== undefined) {
		return { schemeColor: '', noFill: true };
	}
	const solid = fillWrap['a:solidFill'] as XmlObject | undefined;
	if (solid) {
		return parseColorChoiceFill(solid);
	}
	const grad = fillWrap['a:gradFill'] as XmlObject | undefined;
	if (grad) {
		const gradient = parseGradientFill(grad);
		if (gradient) {
			return { schemeColor: '', gradient };
		}
	}
	const patt = fillWrap['a:pattFill'] as XmlObject | undefined;
	if (patt) {
		const pattern = parsePatternFill(patt);
		if (pattern) {
			return { schemeColor: '', pattern };
		}
	}
	return undefined;
}

/**
 * Extract the text properties of a table style section from its `a:tcTxStyle`.
 * Captures bold/italic/underline, the `a:font` typeface, the `a:fontRef` index,
 * and the font colour (scheme via `a:fontRef`/direct, or explicit sRGB).
 */
export function parseTableStyleSectionText(
	section: XmlObject | undefined,
): ParsedTableStyleText | undefined {
	const tcTxStyle = section?.['a:tcTxStyle'] as XmlObject | undefined;
	if (!tcTxStyle) {
		return undefined;
	}

	const result: ParsedTableStyleText = {};
	let hasProps = false;

	if (tcTxStyle['@_b'] === 'on') {
		result.bold = true;
		hasProps = true;
	}
	if (tcTxStyle['@_i'] === 'on') {
		result.italic = true;
		hasProps = true;
	}
	const underline = String(tcTxStyle['@_u'] || '').trim();
	if (underline && underline !== 'none') {
		result.underline = true;
		hasProps = true;
	}

	const font = tcTxStyle['a:font'] as XmlObject | undefined;
	const face = font ? String(font['@_typeface'] || '').trim() : '';
	if (face) {
		result.fontFace = face;
		hasProps = true;
	}

	const fontRef = tcTxStyle['a:fontRef'] as XmlObject | undefined;
	const idx = fontRef ? String(fontRef['@_idx'] || '').trim() : '';
	if (idx) {
		result.fontRefIdx = idx;
		hasProps = true;
	}

	const schemeClr = (fontRef?.['a:schemeClr'] ?? tcTxStyle['a:schemeClr']) as XmlObject | undefined;
	if (schemeClr) {
		const val = String(schemeClr['@_val'] || '').trim();
		if (val) {
			result.fontSchemeColor = val;
			hasProps = true;
			const tintNode = schemeClr['a:tint'] as XmlObject | undefined;
			if (tintNode) {
				result.fontTint = parseInt(String(tintNode['@_val'] || '0'), 10) || undefined;
			}
			const shadeNode = schemeClr['a:shade'] as XmlObject | undefined;
			if (shadeNode) {
				result.fontShade = parseInt(String(shadeNode['@_val'] || '0'), 10) || undefined;
			}
		}
	} else {
		const srgb = (fontRef?.['a:srgbClr'] ?? tcTxStyle['a:srgbClr']) as XmlObject | undefined;
		const hex = toHex(srgb?.['@_val']);
		if (hex) {
			result.fontColor = hex;
			hasProps = true;
		}
	}

	return hasProps ? result : undefined;
}
