import { XmlObject } from '../../types';
import type { ShapeStyle } from '../../types';
import { serializeColorChoice } from '../../utils/color-xml-preservation';
import { reorderObjectKeys, SHAPE_STYLE_ORDER } from '../../utils/xml-reorder';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveXmlHelpers';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Serialize shape fill, stroke, dash, arrows, line join/cap/compound,
	 * and line-level effects to the given spPr XML object.
	 */
	protected applyFillAndStroke(spPr: XmlObject, shapeStyle: ShapeStyle): void {
		const requestedFillMode = shapeStyle.fillMode;
		const gradientFillXml = this.buildGradientFillXml(shapeStyle);

		// Fill
		if (requestedFillMode === 'none' || shapeStyle.fillColor === 'transparent') {
			spPr['a:noFill'] = {};
			delete spPr['a:solidFill'];
			delete spPr['a:gradFill'];
			delete spPr['a:blipFill'];
		} else if (requestedFillMode === 'gradient') {
			delete spPr['a:noFill'];
			delete spPr['a:solidFill'];
			delete spPr['a:blipFill'];
			if (gradientFillXml) {
				spPr['a:gradFill'] = gradientFillXml;
			}
		} else if (requestedFillMode === 'pattern') {
			// Round-trip pattern fill: re-serialize from parsed fields
			delete spPr['a:noFill'];
			delete spPr['a:solidFill'];
			delete spPr['a:gradFill'];
			delete spPr['a:blipFill'];
			const pattNode: XmlObject = {};
			const preset = shapeStyle.fillPatternPreset;
			if (preset) {
				pattNode['@_prst'] = preset;
			}
			// Prefer preserved raw XML colour nodes (retains color transforms)
			if (shapeStyle.fillPatternFgClrXml) {
				pattNode['a:fgClr'] = shapeStyle.fillPatternFgClrXml;
			} else if (shapeStyle.fillColor) {
				pattNode['a:fgClr'] = {
					'a:srgbClr': {
						'@_val': shapeStyle.fillColor.replace('#', ''),
					},
				};
			}
			if (shapeStyle.fillPatternBgClrXml) {
				pattNode['a:bgClr'] = shapeStyle.fillPatternBgClrXml;
			} else if (shapeStyle.fillPatternBackgroundColor) {
				pattNode['a:bgClr'] = {
					'a:srgbClr': {
						'@_val': shapeStyle.fillPatternBackgroundColor.replace('#', ''),
					},
				};
			}
			spPr['a:pattFill'] = pattNode;
		} else if (requestedFillMode === 'solid' || shapeStyle.fillColor !== undefined) {
			const fillColor = String(shapeStyle.fillColor || '').trim();
			if (fillColor.length > 0) {
				delete spPr['a:noFill'];
				delete spPr['a:gradFill'];
				delete spPr['a:blipFill'];
				// Prefer the original colour-choice XML when the resolved
				// hex still matches — preserves scheme/sys/prst identity and
				// colour transforms (lumMod/lumOff/tint/shade/satMod/alpha).
				const resolvedOriginal = shapeStyle.fillColorXml
					? this.parseColor(shapeStyle.fillColorXml)
					: undefined;
				spPr['a:solidFill'] = serializeColorChoice(
					shapeStyle.fillColorXml,
					resolvedOriginal,
					fillColor,
					shapeStyle.fillOpacity,
				);
			}
		}

		// Stroke
		if (shapeStyle.strokeColor !== undefined) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			const lineNode = spPr['a:ln'] as XmlObject;
			const w = Math.round((shapeStyle.strokeWidth || 1) * PptxHandlerRuntime.EMU_PER_PX);
			lineNode['@_w'] = String(w);
			if (shapeStyle.strokeColor === 'transparent' || shapeStyle.strokeWidth === 0) {
				lineNode['a:noFill'] = {};
				delete lineNode['a:solidFill'];
			} else {
				delete lineNode['a:noFill'];
				const resolvedStrokeOriginal = shapeStyle.strokeColorXml
					? this.parseColor(shapeStyle.strokeColorXml)
					: undefined;
				lineNode['a:solidFill'] = serializeColorChoice(
					shapeStyle.strokeColorXml,
					resolvedStrokeOriginal,
					shapeStyle.strokeColor,
					shapeStyle.strokeOpacity,
				);
			}
		}
		if (shapeStyle.strokeDash !== undefined) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			const lineNode = spPr['a:ln'] as XmlObject;
			if (shapeStyle.strokeDash === 'solid') {
				delete lineNode['a:prstDash'];
				delete lineNode['a:custDash'];
			} else if (shapeStyle.strokeDash === 'custom') {
				delete lineNode['a:prstDash'];
				if (shapeStyle.customDashSegments && shapeStyle.customDashSegments.length > 0) {
					lineNode['a:custDash'] = {
						'a:ds': shapeStyle.customDashSegments.map((seg) => ({
							'@_d': String(seg.dash),
							'@_sp': String(seg.space),
						})),
					};
				} else {
					lineNode['a:custDash'] = {
						'a:ds': { '@_d': '200000', '@_sp': '200000' },
					};
				}
			} else {
				lineNode['a:prstDash'] = { '@_val': shapeStyle.strokeDash };
				delete lineNode['a:custDash'];
			}
		}

		// Connector arrows
		if (
			shapeStyle.connectorEndArrow !== undefined &&
			(spPr['a:ln'] || shapeStyle.connectorEndArrow !== 'none')
		) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			const lineNode = spPr['a:ln'] as XmlObject;
			if (shapeStyle.connectorEndArrow === 'none') {
				delete lineNode['a:tailEnd'];
			} else {
				const tailEnd: XmlObject = { '@_type': shapeStyle.connectorEndArrow };
				if (shapeStyle.connectorEndArrowWidth) {
					tailEnd['@_w'] = shapeStyle.connectorEndArrowWidth;
				}
				if (shapeStyle.connectorEndArrowLength) {
					tailEnd['@_len'] = shapeStyle.connectorEndArrowLength;
				}
				lineNode['a:tailEnd'] = tailEnd;
			}
		}
		if (
			shapeStyle.connectorStartArrow !== undefined &&
			(spPr['a:ln'] || shapeStyle.connectorStartArrow !== 'none')
		) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			const lineNode = spPr['a:ln'] as XmlObject;
			if (shapeStyle.connectorStartArrow === 'none') {
				delete lineNode['a:headEnd'];
			} else {
				const headEnd: XmlObject = {
					'@_type': shapeStyle.connectorStartArrow,
				};
				if (shapeStyle.connectorStartArrowWidth) {
					headEnd['@_w'] = shapeStyle.connectorStartArrowWidth;
				}
				if (shapeStyle.connectorStartArrowLength) {
					headEnd['@_len'] = shapeStyle.connectorStartArrowLength;
				}
				lineNode['a:headEnd'] = headEnd;
			}
		}

		// Line join style
		if (shapeStyle.lineJoin !== undefined) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			const lineNode = spPr['a:ln'] as XmlObject;
			delete lineNode['a:round'];
			delete lineNode['a:bevel'];
			delete lineNode['a:miter'];
			if (shapeStyle.lineJoin === 'round') {
				lineNode['a:round'] = {};
			} else if (shapeStyle.lineJoin === 'bevel') {
				lineNode['a:bevel'] = {};
			} else if (shapeStyle.lineJoin === 'miter') {
				const miterNode: XmlObject = {};
				if (
					typeof shapeStyle.miterLimit === 'number' &&
					Number.isFinite(shapeStyle.miterLimit) &&
					shapeStyle.miterLimit !== 800000
				) {
					miterNode['@_lim'] = String(Math.round(shapeStyle.miterLimit));
				}
				lineNode['a:miter'] = miterNode;
			}
		}
		// Line cap style
		if (shapeStyle.lineCap !== undefined) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			(spPr['a:ln'] as XmlObject)['@_cap'] = shapeStyle.lineCap;
		}
		// Compound line type
		if (shapeStyle.compoundLine !== undefined) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			(spPr['a:ln'] as XmlObject)['@_cmpd'] = shapeStyle.compoundLine;
		}
		// Line alignment (a:ln/@algn)
		if (shapeStyle.lineAlignment !== undefined) {
			if (!spPr['a:ln']) {
				spPr['a:ln'] = {};
			}
			(spPr['a:ln'] as XmlObject)['@_algn'] = shapeStyle.lineAlignment;
		}

		// Line-level effects (a:ln/a:effectLst)
		const lineEffectListXml = this.buildLineEffectListXml(shapeStyle);
		if (lineEffectListXml && spPr['a:ln']) {
			(spPr['a:ln'] as XmlObject)['a:effectLst'] = lineEffectListXml;
		}
	}

	/**
	 * Serialize the shape's `<p:style>` block (CT_ShapeStyle §20.1.2.2.36)
	 * from the persisted ref indices/colour XML. Emits children in spec
	 * order: `lnRef → fillRef → effectRef → fontRef`.
	 *
	 * When the original shape XML already contained a `<p:style>` we mutate
	 * that node in place so any unmodelled attributes/children are preserved.
	 * When it didn't, we create one. When the shape no longer has any ref
	 * data we leave the existing `<p:style>` (if any) untouched — silently
	 * dropping it would break round-tripping.
	 *
	 * Phase 2 Stream B / C-H2.
	 */
	protected applyShapeStyleRefs(shape: XmlObject, shapeStyle: ShapeStyle): void {
		const hasAnyRef =
			shapeStyle.lnRefIdx !== undefined ||
			shapeStyle.fillRefIdx !== undefined ||
			shapeStyle.effectRefIdx !== undefined ||
			shapeStyle.fontRefIdx !== undefined;

		if (!hasAnyRef) {
			return;
		}

		const existing = shape['p:style'] as XmlObject | undefined;
		const styleNode: XmlObject = existing ?? {};

		// lnRef
		if (shapeStyle.lnRefIdx !== undefined) {
			const lnRef = (styleNode['a:lnRef'] as XmlObject | undefined) ?? {};
			lnRef['@_idx'] = String(shapeStyle.lnRefIdx);
			this.replaceRefColorChoice(lnRef, shapeStyle.lnRefColorXml);
			styleNode['a:lnRef'] = lnRef;
		}

		// fillRef
		if (shapeStyle.fillRefIdx !== undefined) {
			const fillRef = (styleNode['a:fillRef'] as XmlObject | undefined) ?? {};
			fillRef['@_idx'] = String(shapeStyle.fillRefIdx);
			this.replaceRefColorChoice(fillRef, shapeStyle.fillRefColorXml);
			styleNode['a:fillRef'] = fillRef;
		}

		// effectRef
		if (shapeStyle.effectRefIdx !== undefined) {
			const effectRef = (styleNode['a:effectRef'] as XmlObject | undefined) ?? {};
			effectRef['@_idx'] = String(shapeStyle.effectRefIdx);
			this.replaceRefColorChoice(effectRef, shapeStyle.effectRefColorXml);
			styleNode['a:effectRef'] = effectRef;
		}

		// fontRef
		if (shapeStyle.fontRefIdx !== undefined) {
			const fontRef = (styleNode['a:fontRef'] as XmlObject | undefined) ?? {};
			fontRef['@_idx'] = shapeStyle.fontRefIdx;
			this.replaceRefColorChoice(fontRef, shapeStyle.fontRefColorXml);
			styleNode['a:fontRef'] = fontRef;
		}

		// Reorder children to CT_ShapeStyle order.
		const reordered = reorderObjectKeys(styleNode, SHAPE_STYLE_ORDER);
		for (const key of Object.keys(styleNode)) {
			delete styleNode[key];
		}
		for (const key of Object.keys(reordered)) {
			styleNode[key] = reordered[key];
		}

		shape['p:style'] = styleNode;
	}

	/**
	 * Replace any existing colour-choice child on a style-matrix-reference
	 * element with the given preserved XML, or strip all colour children
	 * when the override is undefined.
	 */
	private replaceRefColorChoice(refNode: XmlObject, colorXml: XmlObject | undefined): void {
		// Strip any pre-existing color choice children.
		for (const key of [
			'a:scrgbClr',
			'a:srgbClr',
			'a:hslClr',
			'a:sysClr',
			'a:schemeClr',
			'a:prstClr',
		]) {
			delete refNode[key];
		}
		if (!colorXml) {
			return;
		}
		for (const [key, value] of Object.entries(colorXml)) {
			refNode[key] = value;
		}
	}
}
