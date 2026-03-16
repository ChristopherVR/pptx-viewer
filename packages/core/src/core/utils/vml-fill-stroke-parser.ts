/**
 * VML fill and stroke property extraction.
 *
 * Reads fill and stroke settings from VML element attributes and child
 * elements (`v:fill`, `v:stroke`) and converts them to the internal
 * {@link ShapeStyle} representation.
 *
 * @module vml-fill-stroke-parser
 */

import type { ShapeStyle, XmlObject } from '../types';
import { parseVmlColor, parseVmlOpacity } from './vml-color-parser';
import { parseCssDimension } from './vml-style-parser';

// ── Fill parsing ─────────────────────────────────────────────────────

/**
 * Extract fill properties from a VML element.
 *
 * VML fill can be specified via:
 * - `fillcolor` attribute on the shape
 * - `filled` attribute (`"f"` or `"false"` means no fill)
 * - Child `v:fill` element with `type`, `color`, `color2`, `opacity`, etc.
 *
 * @param node - Parsed XML node of the VML element.
 * @returns Partial shape style with fill properties.
 */
export function extractVmlFill(node: XmlObject): Partial<ShapeStyle> {
	const style: Partial<ShapeStyle> = {};

	const filled = String(node['@_filled'] ?? '').toLowerCase();
	if (filled === 'f' || filled === 'false') {
		style.fillMode = 'none';
		return style;
	}

	// Check for child v:fill element
	const vFill = node['v:fill'] as XmlObject | undefined;
	if (vFill) {
		const fillType = String(vFill['@_type'] || 'solid').toLowerCase();
		const fillColor =
			parseVmlColor(String(vFill['@_color'] || '')) ||
			parseVmlColor(String(node['@_fillcolor'] || ''));

		if (fillType === 'gradient' || fillType === 'gradientradial') {
			style.fillMode = 'gradient';
			style.fillColor = fillColor;
			const color2 = parseVmlColor(String(vFill['@_color2'] || ''));
			if (fillColor && color2) {
				style.fillGradientType = fillType === 'gradientradial' ? 'radial' : 'linear';
				style.fillGradientStops = [
					{ color: fillColor, position: 0 },
					{ color: color2, position: 1 },
				];
				const angle = parseFloat(String(vFill['@_angle'] || '0'));
				if (Number.isFinite(angle)) {
					style.fillGradientAngle = angle;
				}
			}
		} else if (fillType === 'pattern' || fillType === 'tile') {
			style.fillMode = 'pattern';
			style.fillColor = fillColor;
		} else {
			// solid (default)
			style.fillMode = 'solid';
			style.fillColor = fillColor;
		}

		// Opacity
		const opacityStr = String(vFill['@_opacity'] || '').trim();
		if (opacityStr.length > 0) {
			const opacity = parseVmlOpacity(opacityStr);
			if (opacity !== undefined) {
				style.fillOpacity = opacity;
			}
		}
	} else {
		// No v:fill child — use fillcolor attribute
		const fillColor = parseVmlColor(String(node['@_fillcolor'] || ''));
		if (fillColor) {
			style.fillMode = 'solid';
			style.fillColor = fillColor;
		}
	}

	return style;
}

// ── Stroke parsing ───────────────────────────────────────────────────

/**
 * Map VML arrow type names to DrawingML connector arrow types.
 *
 * @param vmlType - VML arrow type string (e.g. "block", "classic").
 * @returns Corresponding DrawingML arrow type.
 */
function mapVmlArrowType(
	vmlType: string,
): 'triangle' | 'arrow' | 'stealth' | 'diamond' | 'oval' | 'none' {
	const map: Record<string, 'triangle' | 'arrow' | 'stealth' | 'diamond' | 'oval' | 'none'> = {
		block: 'triangle',
		classic: 'stealth',
		open: 'arrow',
		diamond: 'diamond',
		oval: 'oval',
	};
	return map[vmlType] || 'triangle';
}

/**
 * Extract stroke properties from a VML element.
 *
 * VML stroke can be specified via:
 * - `strokecolor`, `strokeweight` attributes on the shape
 * - `stroked` attribute (`"f"` or `"false"` means no stroke)
 * - Child `v:stroke` element with `color`, `weight`, `dashstyle`, etc.
 *
 * @param node - Parsed XML node of the VML element.
 * @returns Partial shape style with stroke properties.
 */
export function extractVmlStroke(node: XmlObject): Partial<ShapeStyle> {
	const style: Partial<ShapeStyle> = {};

	const stroked = String(node['@_stroked'] ?? '').toLowerCase();
	if (stroked === 'f' || stroked === 'false') {
		style.strokeWidth = 0;
		return style;
	}

	// Check for child v:stroke element
	const vStroke = node['v:stroke'] as XmlObject | undefined;
	if (vStroke) {
		const strokeColor =
			parseVmlColor(String(vStroke['@_color'] || '')) ||
			parseVmlColor(String(node['@_strokecolor'] || ''));
		if (strokeColor) {
			style.strokeColor = strokeColor;
		}

		const weight = String(vStroke['@_weight'] || node['@_strokeweight'] || '').trim();
		if (weight.length > 0) {
			style.strokeWidth = parseCssDimension(weight);
		}

		// Dash style mapping
		const dashStyle = String(vStroke['@_dashstyle'] || '').toLowerCase();
		if (dashStyle && dashStyle !== 'solid') {
			const dashMap: Record<string, ShapeStyle['strokeDash']> = {
				dash: 'dash',
				dot: 'dot',
				dashdot: 'dashDot',
				longdash: 'lgDash',
				longdashdot: 'lgDashDot',
				longdashdotdot: 'lgDashDotDot',
				shortdash: 'dash',
				shortdot: 'sysDot',
				shortdashdot: 'dashDot',
				shortdashdotdot: 'sysDashDotDot',
			};
			style.strokeDash = dashMap[dashStyle];
		}

		// Opacity
		const opacityStr = String(vStroke['@_opacity'] || '').trim();
		if (opacityStr.length > 0) {
			const opacity = parseVmlOpacity(opacityStr);
			if (opacity !== undefined) {
				style.strokeOpacity = opacity;
			}
		}

		// Arrow heads
		const startArrow = String(vStroke['@_startarrow'] || '').toLowerCase();
		const endArrow = String(vStroke['@_endarrow'] || '').toLowerCase();
		if (startArrow && startArrow !== 'none') {
			style.connectorStartArrow = mapVmlArrowType(startArrow);
		}
		if (endArrow && endArrow !== 'none') {
			style.connectorEndArrow = mapVmlArrowType(endArrow);
		}
	} else {
		// No v:stroke child — use attributes
		const strokeColor = parseVmlColor(String(node['@_strokecolor'] || ''));
		if (strokeColor) {
			style.strokeColor = strokeColor;
		}

		const weight = String(node['@_strokeweight'] || '').trim();
		if (weight.length > 0) {
			style.strokeWidth = parseCssDimension(weight);
		}
	}

	// Default stroke if stroked is not explicitly false and no width set
	if (style.strokeWidth === undefined && stroked !== 'f') {
		style.strokeWidth = 1;
	}

	return style;
}
