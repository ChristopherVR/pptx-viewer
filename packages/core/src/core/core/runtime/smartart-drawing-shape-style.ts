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
	/** The shape declares `a:noFill` and must not be painted at all. */
	fillNone?: boolean;
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
	hasChild(node: XmlObject | undefined, local: string): boolean;
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
 *
 * `a:noFill` is a fill in its own right, not the absence of one: SmartArt
 * layouts stack an unfilled shape over a painted one to hold the label, so a
 * renderer that treats "no colour resolved" as "use the palette" hides whatever
 * the layout put underneath.
 */
export function extractDrawingShapeFill(
	spPr: XmlObject,
	deps: DrawingShapeStyleDeps,
): DrawingShapeFill {
	const result: DrawingShapeFill = {};

	if (deps.hasChild(spPr, 'noFill')) {
		result.fillNone = true;
		const noFillShadowColor = deps.extractShadowColor(spPr);
		if (noFillShadowColor) {
			result.hasShadow = true;
			result.shadowColor = noFillShadowColor;
		}
		return result;
	}

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

/** Font size (CSS pixels) + colour resolved from the first styled run of a `txBody`. */
export interface DrawingShapeTextStyle {
	fontSize: number | undefined;
	fontColor: string | undefined;
	fontFamily?: string;
	fontWeight?: number;
	fontStyle?: 'normal' | 'italic';
	lineHeight?: number;
	lineHeightRatio?: number;
	lineSpacingAfter?: number;
	lineSpacingAfterRatio?: number;
	textInsetLeft?: number;
	textInsetTop?: number;
	textInsetRight?: number;
	textInsetBottom?: number;
	textVerticalAnchor?: string;
}

export function drawingTextEmuAttribute(
	node: XmlObject | undefined,
	name: string,
	emuPerPx: number,
): number | undefined {
	if (!node || node[`@_${name}`] === undefined) {
		return undefined;
	}
	const value = Number.parseInt(String(node[`@_${name}`]), 10);
	return Number.isFinite(value) ? value / emuPerPx : undefined;
}

function drawingTextBoolean(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

/**
 * Resolve the font size + colour of a cached drawing shape from the first
 * run properties found in its `txBody`.
 */
export function extractDrawingShapeTextStyle(
	txBody: XmlObject | undefined,
	deps: DrawingShapeStyleDeps,
	emuPerPx: number,
): DrawingShapeTextStyle {
	let fontSize: number | undefined;
	let fontColor: string | undefined;
	let fontFamily: string | undefined;
	let fontWeight: number | undefined;
	let fontStyle: 'normal' | 'italic' | undefined;
	let lineHeight: number | undefined;
	let lineHeightRatio: number | undefined;
	let lineSpacingAfter: number | undefined;
	let lineSpacingAfterRatio: number | undefined;
	if (!txBody) {
		return { fontSize, fontColor };
	}

	const bodyPr = deps.getChild(txBody, 'bodyPr');
	const paragraphs = deps.getChildren(txBody, 'p');
	for (const p of paragraphs) {
		const pPr = deps.getChild(p, 'pPr');
		const lineSpacing = deps.getChild(pPr, 'lnSpc');
		const lineSpacingPercent = deps.getChild(lineSpacing, 'spcPct');
		const lineSpacingPoints = deps.getChild(lineSpacing, 'spcPts');
		const spacingAfter = deps.getChild(pPr, 'spcAft');
		const spacingAfterPercent = deps.getChild(spacingAfter, 'spcPct');
		const spacingAfterPoints = deps.getChild(spacingAfter, 'spcPts');
		if (lineHeightRatio === undefined && lineSpacingPercent?.['@_val'] !== undefined) {
			const raw = Number.parseInt(String(lineSpacingPercent['@_val']), 10);
			if (Number.isFinite(raw) && raw > 0) {
				lineHeightRatio = raw / 100000;
			}
		}
		if (lineHeight === undefined && lineSpacingPoints?.['@_val'] !== undefined) {
			const raw = Number.parseInt(String(lineSpacingPoints['@_val']), 10);
			if (Number.isFinite(raw) && raw > 0) {
				lineHeight = (raw / 100) * (96 / 72);
			}
		}
		if (lineSpacingAfterRatio === undefined && spacingAfterPercent?.['@_val'] !== undefined) {
			const raw = Number.parseInt(String(spacingAfterPercent['@_val']), 10);
			if (Number.isFinite(raw) && raw >= 0) {
				lineSpacingAfterRatio = raw / 100000;
			}
		}
		if (lineSpacingAfter === undefined && spacingAfterPoints?.['@_val'] !== undefined) {
			const raw = Number.parseInt(String(spacingAfterPoints['@_val']), 10);
			if (Number.isFinite(raw) && raw >= 0) {
				lineSpacingAfter = (raw / 100) * (96 / 72);
			}
		}
		const runs = deps.getChildren(p, 'r');
		for (const r of runs) {
			const rPr = deps.getChild(r, 'rPr');
			if (rPr) {
				const szRaw = parseInt(String(rPr['@_sz'] || ''), 10);
				if (fontSize === undefined && Number.isFinite(szRaw) && szRaw > 0) {
					fontSize = (szRaw / 100) * (96 / 72);
				}
				fontColor ??= deps.parseColor(deps.getChild(rPr, 'solidFill')) ?? undefined;
				const eastAsian = deps.getChild(rPr, 'ea');
				const latin = deps.getChild(rPr, 'latin');
				const complexScript = deps.getChild(rPr, 'cs');
				fontFamily ??=
					String(
						eastAsian?.['@_typeface'] ||
							latin?.['@_typeface'] ||
							complexScript?.['@_typeface'] ||
							'',
					).trim() || undefined;
				if (fontWeight === undefined && rPr['@_b'] !== undefined) {
					fontWeight = drawingTextBoolean(rPr['@_b']) ? 700 : 400;
				}
				if (fontStyle === undefined && rPr['@_i'] !== undefined) {
					fontStyle = drawingTextBoolean(rPr['@_i']) ? 'italic' : 'normal';
				}
			}
			if (fontSize !== undefined && fontFamily !== undefined && fontColor !== undefined) {
				break;
			}
		}
		if (fontSize !== undefined && fontFamily !== undefined && fontColor !== undefined) {
			break;
		}
	}

	return {
		fontSize,
		fontColor,
		fontFamily,
		fontWeight,
		fontStyle,
		lineHeight,
		lineHeightRatio,
		lineSpacingAfter,
		lineSpacingAfterRatio,
		textInsetLeft: drawingTextEmuAttribute(bodyPr, 'lIns', emuPerPx),
		textInsetTop: drawingTextEmuAttribute(bodyPr, 'tIns', emuPerPx),
		textInsetRight: drawingTextEmuAttribute(bodyPr, 'rIns', emuPerPx),
		textInsetBottom: drawingTextEmuAttribute(bodyPr, 'bIns', emuPerPx),
		textVerticalAnchor: String(bodyPr?.['@_anchor'] || '').trim() || undefined,
	};
}
