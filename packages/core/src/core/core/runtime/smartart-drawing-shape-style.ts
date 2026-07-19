/**
 * Pure fill / effect / text-style extraction for SmartArt cached drawing
 * shapes (`ppt/diagrams/drawing*.xml`, `dsp:sp`).
 *
 * Built-in SmartArt layouts frequently paint their cached shapes with picture,
 * gradient, or pattern fills (and outer shadows for the 3D quick styles). The
 * cached-shape reader historically read only `a:solidFill`, so those layouts
 * rendered as flat solid boxes. These helpers reuse the shared colour/gradient
 * codec (via a small dependency object) so no new colour logic is introduced.
 *
 * @module pptx-runtime/smartart-drawing-shape-style
 */

import type { XmlObject } from '../../types';

/** Structured gradient stop consumed by the SmartArt drawing renderer. */
export interface DrawingShapeGradientStop {
	color: string;
	position: number;
	opacity?: number;
}

/** Fill / effect fields resolved from a cached drawing shape's `spPr`. */
export interface DrawingShapeFill {
	fillColor?: string;
	fillGradientStops?: DrawingShapeGradientStop[];
	fillGradientType?: 'linear' | 'radial';
	fillGradientAngle?: number;
	fillPatternPreset?: string;
	fillPatternForegroundColor?: string;
	fillPatternBackgroundColor?: string;
	fillBlipEmbedId?: string;
	hasShadow?: boolean;
	shadowColor?: string;
}

/** Injected accessors so these helpers stay free of runtime coupling. */
export interface DrawingShapeStyleDeps {
	getChild(node: XmlObject | undefined, local: string): XmlObject | undefined;
	getChildren(node: XmlObject | undefined, local: string): XmlObject[];
	parseColor(node: XmlObject | undefined): string | undefined;
	extractGradientStops(gradFill: XmlObject): DrawingShapeGradientStop[];
	extractGradientType(gradFill: XmlObject): 'linear' | 'radial';
	extractGradientAngle(gradFill: XmlObject): number;
	extractShadowColor(spPr: XmlObject): string | undefined;
}

/**
 * Resolve the fill + shadow of a cached drawing shape from its `spPr`.
 *
 * Only one fill child is meaningful per the schema (`a:solidFill` /
 * `a:gradFill` / `a:blipFill` / `a:pattFill` / `a:noFill`), so the first match
 * wins. `a:blipFill` cannot be resolved to image bytes here (the drawing part's
 * relationships live outside this module); its `r:embed` id is captured for the
 * caller to resolve.
 */
export function extractDrawingShapeFill(
	spPr: XmlObject,
	deps: DrawingShapeStyleDeps,
): DrawingShapeFill {
	const result: DrawingShapeFill = {};

	const solidFill = deps.getChild(spPr, 'solidFill');
	if (solidFill) {
		result.fillColor = deps.parseColor(solidFill) ?? undefined;
	}

	const gradFill = !solidFill ? deps.getChild(spPr, 'gradFill') : undefined;
	if (gradFill) {
		const stops = deps.extractGradientStops(gradFill).map((stop) => ({
			color: stop.color,
			position: stop.position,
			...(stop.opacity !== undefined ? { opacity: stop.opacity } : {}),
		}));
		if (stops.length > 0) {
			result.fillGradientStops = stops;
			result.fillGradientType = deps.extractGradientType(gradFill);
			result.fillGradientAngle = deps.extractGradientAngle(gradFill);
			// Provide a solid fallback (mid stop) so renderers without gradient
			// support still show a representative colour rather than nothing.
			result.fillColor ??= stops[Math.floor(stops.length / 2)]?.color;
		}
	}

	const pattFill = !solidFill && !gradFill ? deps.getChild(spPr, 'pattFill') : undefined;
	if (pattFill) {
		const preset = String(pattFill['@_prst'] || '').trim();
		if (preset) {
			result.fillPatternPreset = preset;
		}
		const fg = deps.parseColor(deps.getChild(pattFill, 'fgClr'));
		const bg = deps.parseColor(deps.getChild(pattFill, 'bgClr'));
		if (fg) {
			result.fillPatternForegroundColor = fg;
		}
		if (bg) {
			result.fillPatternBackgroundColor = bg;
		}
		// Foreground colour is the best flat-fill fallback for a pattern.
		result.fillColor ??= fg ?? bg;
	}

	const blipFill =
		!solidFill && !gradFill && !pattFill ? deps.getChild(spPr, 'blipFill') : undefined;
	if (blipFill) {
		const blip = deps.getChild(blipFill, 'blip');
		const embed = String(
			blip?.['@_r:embed'] || blip?.['@_embed'] || blip?.['@_r:link'] || '',
		).trim();
		if (embed) {
			result.fillBlipEmbedId = embed;
		}
	}

	const shadowColor = deps.extractShadowColor(spPr);
	if (shadowColor) {
		result.hasShadow = true;
		result.shadowColor = shadowColor;
	}

	return result;
}

/** Font size (points) + colour resolved from the first styled run of a `txBody`. */
export interface DrawingShapeTextStyle {
	fontSize: number | undefined;
	fontColor: string | undefined;
}

/**
 * Resolve the font size + colour of a cached drawing shape from the first
 * run properties found in its `txBody`.
 */
export function extractDrawingShapeTextStyle(
	txBody: XmlObject | undefined,
	deps: DrawingShapeStyleDeps,
): DrawingShapeTextStyle {
	let fontSize: number | undefined;
	let fontColor: string | undefined;
	if (!txBody) {
		return { fontSize, fontColor };
	}

	const paragraphs = deps.getChildren(txBody, 'p');
	for (const p of paragraphs) {
		const runs = deps.getChildren(p, 'r');
		for (const r of runs) {
			const rPr = deps.getChild(r, 'rPr');
			if (rPr && !fontSize) {
				const szRaw = parseInt(String(rPr['@_sz'] || ''), 10);
				if (Number.isFinite(szRaw) && szRaw > 0) {
					fontSize = szRaw / 100;
				}
				fontColor = deps.parseColor(deps.getChild(rPr, 'solidFill')) ?? undefined;
			}
			if (fontSize) {
				break;
			}
		}
		if (fontSize) {
			break;
		}
	}

	return { fontSize, fontColor };
}
