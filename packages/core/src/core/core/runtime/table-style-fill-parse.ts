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
import { parseSolidFillStyle, parseTintShadeVal } from './table-style-border-parse';

/**
 * Resolves a table style section's `a:blipFill` relationship id (`r:embed` /
 * `r:link`) to an archive-relative path (or an already-external URL), the
 * same way core resolves any other blip. Optional so callers without a
 * relationship map wired up (e.g. unit tests, or the built-in style
 * catalogue generator) simply skip the `a:blipFill` branch.
 */
export type ResolveTableStyleImagePath = (
	rEmbed: string | undefined,
	rLink: string | undefined,
) => string | undefined;

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
	const tint = tintRaw ? parseTintShadeVal(tintRaw['@_val']) : undefined;
	if (tint !== undefined) {
		fill.tint = tint;
	}
	const shadeRaw = srgb?.['a:shade'] as XmlObject | undefined;
	const shade = shadeRaw ? parseTintShadeVal(shadeRaw['@_val']) : undefined;
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
 * Resolve an already-unwrapped EG_FillProperties choice node (a `a:tcStyle/
 * a:fill` wrapper's contents, or `a:tblPr`'s own directly-child fill) into a
 * {@link ParsedTableStyleFill}. Handles solid (scheme + sRGB), gradient,
 * pattern, image, and no-fill. Shared by {@link parseTableStyleSectionFill}
 * (table-style sections) and {@link parseTablePropertiesFill} (`a:tblPr`'s
 * own fill, issue G6), which differ only in where the choice node sits.
 */
function parseFillChoiceNode(
	fillWrap: XmlObject | undefined,
	resolveImagePath?: ResolveTableStyleImagePath,
): ParsedTableStyleFill | undefined {
	if (!fillWrap) {
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
	const blip = fillWrap['a:blipFill'] as XmlObject | undefined;
	if (blip && resolveImagePath) {
		const blipNode = blip['a:blip'] as XmlObject | undefined;
		const rEmbed = blipNode?.['@_r:embed'] ? String(blipNode['@_r:embed']) : undefined;
		const rLink = blipNode?.['@_r:link'] ? String(blipNode['@_r:link']) : undefined;
		const path = resolveImagePath(rEmbed, rLink);
		if (path) {
			return { schemeColor: '', image: { path } };
		}
	}
	return undefined;
}

/**
 * Extract the fill of a table style section (`a:wholeTbl`, `a:band1H`,
 * `a:seCell`, ...) from its `a:tcStyle/a:fill` choice. Returns `undefined`
 * when the section defines no resolvable fill (including the unresolved
 * `a:fillRef` case).
 */
export function parseTableStyleSectionFill(
	section: XmlObject | undefined,
	resolveImagePath?: ResolveTableStyleImagePath,
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
	return parseFillChoiceNode(fillWrap, resolveImagePath);
}

/**
 * Extract `<a:tblPr>`'s OWN fill (`CT_TableProperties` §21.1.3.15's
 * `EG_FillProperties` group), independent of `a:tblStyleLst`/`a:tblBg`.
 *
 * Unlike a table-style section's fill, which nests under `a:tcStyle/a:fill`,
 * `a:tblPr`'s fill choice (`a:noFill`/`a:solidFill`/`a:gradFill`/
 * `a:blipFill`/`a:pattFill`) sits directly on `a:tblPr` itself. Real
 * PowerPoint decks route table appearance through `tableStyleId` instead, so
 * this is reachable mainly from non-PowerPoint authoring tools or hand-edited
 * XML (issue G6).
 */
export function parseTablePropertiesFill(
	tblPr: XmlObject | undefined,
	resolveImagePath?: ResolveTableStyleImagePath,
): ParsedTableStyleFill | undefined {
	return parseFillChoiceNode(tblPr, resolveImagePath);
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

	// `CT_TableStyleTextStyle`'s own colour child is the text colour PowerPoint
	// applies (its built-in styles pair a placeholder `a:prstClr black` inside
	// `a:fontRef` with the real `a:schemeClr` beside it). A colour nested inside
	// `a:fontRef` is read only as a fallback, for files an earlier writer of this
	// library produced.
	const schemeClr = (tcTxStyle['a:schemeClr'] ?? fontRef?.['a:schemeClr']) as XmlObject | undefined;
	if (schemeClr) {
		const val = String(schemeClr['@_val'] || '').trim();
		if (val) {
			result.fontSchemeColor = val;
			hasProps = true;
			const tintNode = schemeClr['a:tint'] as XmlObject | undefined;
			if (tintNode) {
				result.fontTint = parseTintShadeVal(tintNode['@_val']);
			}
			const shadeNode = schemeClr['a:shade'] as XmlObject | undefined;
			if (shadeNode) {
				result.fontShade = parseTintShadeVal(shadeNode['@_val']);
			}
		}
	} else {
		const srgb = (tcTxStyle['a:srgbClr'] ?? fontRef?.['a:srgbClr']) as XmlObject | undefined;
		const hex = toHex(srgb?.['@_val']);
		if (hex) {
			result.fontColor = hex;
			hasProps = true;
		}
	}

	return hasProps ? result : undefined;
}
