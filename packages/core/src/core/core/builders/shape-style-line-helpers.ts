import type { ConnectorArrowType, ShapeStyle, StrokeDashType, XmlObject } from '../../types';
import { extractColorChoiceXml } from '../../utils/color-xml-preservation';
import { parseDrawingLineDash } from '../../utils/drawing-line-dash';
import { hasDrawingChild } from './drawing-fill-xml';

export interface ShapeLineStyleContext {
	emuPerPx: number;
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
	extractGradientFillColor: (gradFill: XmlObject) => string | undefined;
	extractGradientOpacity: (gradFill: XmlObject) => number | undefined;
	// Structured gradient data for the outline. The averaged `strokeColor` alone
	// cannot express a two-tone or fade-to-transparent outline.
	extractGradientStops: (gradFill: XmlObject) => NonNullable<ShapeStyle['fillGradientStops']>;
	extractGradientAngle: (gradFill: XmlObject) => number;
	extractGradientType: (gradFill: XmlObject) => NonNullable<ShapeStyle['fillGradientType']>;
	extractGradientPathType: (gradFill: XmlObject) => ShapeStyle['fillGradientPathType'];
	normalizeStrokeDashType: (value: unknown) => StrokeDashType | undefined;
	normalizeConnectorArrowType: (value: unknown) => ConnectorArrowType | undefined;
	ensureArray: (value: unknown) => unknown[];
}

/**
 * Extract line/stroke properties from an `a:ln` node and apply them to the style.
 * Returns `true` if the caller should perform an early return (noFill case).
 */
export function applyLineProperties(
	lineNode: XmlObject,
	style: ShapeStyle,
	context: ShapeLineStyleContext,
): boolean {
	// `<a:noFill/>` parses to the empty STRING, so a truthiness test silently
	// treated "no outline" as "no line element at all": the width on the very
	// same `a:ln` then became a real stroke, painting a border PowerPoint does
	// not draw (a hairline `<a:ln w="3175"><a:noFill/></a:ln>` divider showed up
	// as a visible 1px line).
	if (hasDrawingChild(lineNode, 'noFill')) {
		// `a:noFill` means no outline, full stop. `a14:hiddenLine` is only where
		// PowerPoint REMEMBERS the outline the shape would get if it were turned
		// back on; it is not painted. (Verified against PowerPoint itself: for
		// shapes carrying `a14:hiddenLine`, the object model reports
		// `Shape.Line.Visible = 0`.) Reviving it drew outlines on shapes that
		// render bare, and made unfilled/unstroked text placeholders look like
		// styled shapes. The extension survives a round-trip via the preserved
		// `a:extLst`, so nothing is lost by ignoring it here.
		style.strokeFillMode = 'none';
		style.strokeWidth = 0;
		style.strokeColor = 'transparent';
		return true;
	}

	if (lineNode['@_w']) {
		style.strokeWidth = parseInt(String(lineNode['@_w']), 10) / context.emuPerPx;
	}

	applyStrokeColor(lineNode, style, context);
	applyDashProperties(lineNode, style, context);
	applyArrowProperties(lineNode, style, context);
	applyJoinCapCompound(lineNode, style);
	applyLineEffects(lineNode, style, context);

	return false;
}

function applyStrokeColor(
	lineNode: XmlObject,
	style: ShapeStyle,
	context: ShapeLineStyleContext,
): void {
	if (lineNode['a:solidFill']) {
		style.strokeFillMode = 'solid';
		const lineFill = lineNode['a:solidFill'] as XmlObject;
		style.strokeColor = context.parseColor(lineFill);
		style.strokeOpacity = context.extractColorOpacity(lineFill);
		const strokeColorXml = extractColorChoiceXml(lineFill);
		if (strokeColorXml) {
			style.strokeColorXml = strokeColorXml;
		}
	} else if (lineNode['a:gradFill']) {
		// Preserve the whole gradient node so save can re-emit a single
		// `a:gradFill` outline verbatim (issue #87). `strokeColor` keeps an
		// averaged colour so solid-only stroke renderers still paint something.
		style.strokeFillMode = 'gradient';
		const lineGradFill = lineNode['a:gradFill'] as XmlObject;
		style.strokeGradientXml = lineGradFill;
		style.strokeColor = context.extractGradientFillColor(lineGradFill);
		style.strokeOpacity = context.extractGradientOpacity(lineGradFill);
		// Structured form for renderers: the averaged colour above flattens a
		// two-tone outline and makes a fade-to-transparent one fully opaque.
		const lineStops = context.extractGradientStops(lineGradFill);
		if (lineStops.length > 0) {
			style.strokeGradientStops = lineStops;
			style.strokeGradientAngle = context.extractGradientAngle(lineGradFill);
			style.strokeGradientType = context.extractGradientType(lineGradFill);
			style.strokeGradientPathType = context.extractGradientPathType(lineGradFill);
		}
	} else if (lineNode['a:pattFill']) {
		// Preserve the whole pattern node so save re-emits a single `a:pattFill`
		// outline verbatim rather than downgrading it to a solid fill.
		style.strokeFillMode = 'pattern';
		const linePatternFill = lineNode['a:pattFill'] as XmlObject;
		style.strokePatternXml = linePatternFill;
		style.strokeColor =
			context.parseColor(linePatternFill['a:fgClr'] as XmlObject | undefined) ||
			context.parseColor(linePatternFill['a:bgClr'] as XmlObject | undefined);
		style.strokeOpacity =
			context.extractColorOpacity(linePatternFill['a:fgClr'] as XmlObject | undefined) ||
			context.extractColorOpacity(linePatternFill['a:bgClr'] as XmlObject | undefined);
		// Structured form, mirroring `fillPatternPreset` / `fillPatternBackgroundColor`.
		const linePatternPreset = String(linePatternFill['@_prst'] || '').trim();
		if (linePatternPreset.length > 0) {
			style.strokePatternPreset = linePatternPreset;
		}
		const linePatternBg = context.parseColor(linePatternFill['a:bgClr'] as XmlObject | undefined);
		if (linePatternBg) {
			style.strokePatternBackgroundColor = linePatternBg;
		}
	}
}

function applyDashProperties(
	lineNode: XmlObject,
	style: ShapeStyle,
	context: ShapeLineStyleContext,
): void {
	Object.assign(style, parseDrawingLineDash(lineNode, context.normalizeStrokeDashType));
}

function applyArrowProperties(
	lineNode: XmlObject,
	style: ShapeStyle,
	context: ShapeLineStyleContext,
): void {
	const headEndType = context.normalizeConnectorArrowType(
		(lineNode['a:headEnd'] as XmlObject | undefined)?.['@_type'],
	);
	if (headEndType) {
		style.connectorStartArrow = headEndType;
	}
	const headEndWidth = String((lineNode['a:headEnd'] as XmlObject | undefined)?.['@_w'] || '')
		.trim()
		.toLowerCase();
	if (headEndWidth === 'sm' || headEndWidth === 'med' || headEndWidth === 'lg') {
		style.connectorStartArrowWidth = headEndWidth;
	}
	const headEndLength = String((lineNode['a:headEnd'] as XmlObject | undefined)?.['@_len'] || '')
		.trim()
		.toLowerCase();
	if (headEndLength === 'sm' || headEndLength === 'med' || headEndLength === 'lg') {
		style.connectorStartArrowLength = headEndLength;
	}

	const tailEndType = context.normalizeConnectorArrowType(
		(lineNode['a:tailEnd'] as XmlObject | undefined)?.['@_type'],
	);
	if (tailEndType) {
		style.connectorEndArrow = tailEndType;
	}
	const tailEndWidth = String((lineNode['a:tailEnd'] as XmlObject | undefined)?.['@_w'] || '')
		.trim()
		.toLowerCase();
	if (tailEndWidth === 'sm' || tailEndWidth === 'med' || tailEndWidth === 'lg') {
		style.connectorEndArrowWidth = tailEndWidth;
	}
	const tailEndLength = String((lineNode['a:tailEnd'] as XmlObject | undefined)?.['@_len'] || '')
		.trim()
		.toLowerCase();
	if (tailEndLength === 'sm' || tailEndLength === 'med' || tailEndLength === 'lg') {
		style.connectorEndArrowLength = tailEndLength;
	}
}

function applyJoinCapCompound(lineNode: XmlObject, style: ShapeStyle): void {
	if ('a:round' in lineNode) {
		style.lineJoin = 'round';
	} else if ('a:bevel' in lineNode) {
		style.lineJoin = 'bevel';
	} else if ('a:miter' in lineNode) {
		style.lineJoin = 'miter';
		const miterNode = lineNode['a:miter'] as XmlObject | undefined;
		const limRaw = miterNode?.['@_lim'];
		if (limRaw !== undefined && limRaw !== '') {
			const parsed = parseInt(String(limRaw), 10);
			if (Number.isFinite(parsed)) {
				style.miterLimit = parsed;
			}
		}
	}

	const capValue = String(lineNode['@_cap'] || '')
		.trim()
		.toLowerCase();
	if (capValue === 'rnd' || capValue === 'sq' || capValue === 'flat') {
		style.lineCap = capValue as ShapeStyle['lineCap'];
	}

	const compoundValue = String(lineNode['@_cmpd'] || '').trim();
	if (
		compoundValue === 'sng' ||
		compoundValue === 'dbl' ||
		compoundValue === 'thickThin' ||
		compoundValue === 'thinThick' ||
		compoundValue === 'tri'
	) {
		style.compoundLine = compoundValue as ShapeStyle['compoundLine'];
	}

	const algnValue = String(lineNode['@_algn'] || '').trim();
	if (algnValue === 'ctr' || algnValue === 'in') {
		style.lineAlignment = algnValue;
	}
}

function applyLineEffects(
	lineNode: XmlObject,
	style: ShapeStyle,
	context: ShapeLineStyleContext,
): void {
	const lineEffectList = lineNode['a:effectLst'] as XmlObject | undefined;
	if (!lineEffectList) {
		return;
	}

	const lineOuterShdw = lineEffectList['a:outerShdw'] as XmlObject | undefined;
	if (lineOuterShdw) {
		style.lineShadowColor = context.parseColor(lineOuterShdw) || '#000000';
		style.lineShadowOpacity = context.extractColorOpacity(lineOuterShdw) ?? 0.5;
		const lsBlurRaw = parseInt(String(lineOuterShdw['@_blurRad'] || ''), 10);
		const lsDistRaw = parseInt(String(lineOuterShdw['@_dist'] || ''), 10);
		const lsDirRaw = parseInt(String(lineOuterShdw['@_dir'] || ''), 10);
		style.lineShadowBlur =
			Number.isFinite(lsBlurRaw) && lsBlurRaw >= 0 ? lsBlurRaw / context.emuPerPx : 4;
		const lsDist = Number.isFinite(lsDistRaw) && lsDistRaw >= 0 ? lsDistRaw / context.emuPerPx : 0;
		const lsDirDeg = Number.isFinite(lsDirRaw) ? lsDirRaw / 60000 : 0;
		const lsDirRad = (lsDirDeg * Math.PI) / 180;
		style.lineShadowOffsetX = Math.round(Math.cos(lsDirRad) * lsDist * 100) / 100;
		style.lineShadowOffsetY = Math.round(Math.sin(lsDirRad) * lsDist * 100) / 100;
	}

	const lineGlow = lineEffectList['a:glow'] as XmlObject | undefined;
	if (lineGlow) {
		style.lineGlowColor = context.parseColor(lineGlow);
		style.lineGlowOpacity = context.extractColorOpacity(lineGlow);
		const lgRadRaw = parseInt(String(lineGlow['@_rad'] || ''), 10);
		style.lineGlowRadius =
			Number.isFinite(lgRadRaw) && lgRadRaw >= 0 ? lgRadRaw / context.emuPerPx : undefined;
	}
}
