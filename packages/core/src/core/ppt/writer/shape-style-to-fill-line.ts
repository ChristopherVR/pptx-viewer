/**
 * `ShapeStyle` (the resolved fill/line the renderer already computed) ->
 * `WFill` / `WLine` for the `.ppt` writer.
 *
 * @module ppt/writer/shape-style-to-fill-line
 */

import { EMU_PER_PX } from '../../constants';
import type { XmlObject } from '../../types/common';
import type { ShapeStyle } from '../../types/shape-style';
import { xmlAttr, xmlChild } from '../../utils/xml-access';
import type { WFill, WLine } from './write-model';

const DASH_NAMES = new Set([
	'solid',
	'dash',
	'dot',
	'dashDot',
	'lgDash',
	'lgDashDot',
	'lgDashDotDot',
]);

function strip(rgb: string | undefined): string | undefined {
	return rgb?.replace(/^#/u, '');
}

/**
 * Read a plain `<a:srgbClr val="RRGGBB"/>` straight off a preserved raw XML
 * colour node, with no theme lookup. `undefined` for anything else
 * (`a:schemeClr`, `a:prstClr`, ...): resolving those needs the theme this
 * pure function is never given, so a pattern/theme fill with only a scheme
 * colour still degrades rather than guessing a colour.
 */
function plainSrgbHex(node: XmlObject | undefined): string | undefined {
	const srgb = xmlChild(node, 'a:srgbClr');
	return srgb ? xmlAttr(srgb, 'val') : undefined;
}

/**
 * Best-effort representative solid for a pattern fill: PowerPoint's own
 * `pattFill` needs a foreground/background raster this writer does not
 * fabricate, so the pattern is approximated by its own foreground colour
 * (the visually dominant one for every built-in preset except the very
 * sparse ones), falling back to the background colour, so the shape stays
 * visible instead of vanishing.
 */
function patternRepresentativeSolid(style: ShapeStyle): string | undefined {
	return (
		plainSrgbHex(style.fillPatternFgClrXml) ??
		style.fillPatternBackgroundColor?.replace(/^#/u, '') ??
		plainSrgbHex(style.fillPatternBgClrXml)
	);
}

/** Resolve a shape's fill from its `ShapeStyle`. */
export function resolveFill(style: ShapeStyle | undefined): WFill | undefined {
	if (!style || style.fillMode === 'none') {
		return { kind: 'none' };
	}
	if (
		style.fillMode === 'gradient' &&
		style.fillGradientStops &&
		style.fillGradientStops.length > 0
	) {
		return {
			kind: 'gradient',
			angleDeg: style.fillGradientAngle ?? 0,
			stops: style.fillGradientStops.map((s) => ({
				rgb: strip(s.color) ?? '000000',
				position: s.position,
			})),
		};
	}
	if (style.fillColor) {
		return { kind: 'solid', rgb: strip(style.fillColor)! };
	}
	if (style.fillMode === 'pattern') {
		const representative = patternRepresentativeSolid(style);
		if (representative) {
			return { kind: 'solid', rgb: strip(representative)! };
		}
	}
	// Image/theme/group fills with no resolved fillColor, and a pattern whose
	// only colour is a theme reference this pure function cannot look up,
	// degrade to no fill: the true equivalent (msofillTexture/msofillPicture)
	// needs an embedded picture blip this writer does not fabricate for a fill.
	return { kind: 'none' };
}

/** Resolve a shape's outline from its `ShapeStyle`. */
export function resolveLine(style: ShapeStyle | undefined): WLine | undefined {
	if (!style || !style.strokeColor || style.strokeWidth === 0) {
		return { kind: 'none' };
	}
	const dash = style.strokeDash && DASH_NAMES.has(style.strokeDash) ? style.strokeDash : undefined;
	return {
		kind: 'line',
		rgb: strip(style.strokeColor)!,
		widthEmu: Math.max(1, Math.round((style.strokeWidth ?? 1) * EMU_PER_PX)),
		dash,
	};
}
