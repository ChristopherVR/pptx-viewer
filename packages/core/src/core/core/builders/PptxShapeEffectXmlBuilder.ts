import type { ShapeStyle, XmlObject } from '../../types';
import {
	buildBlurXml,
	buildLineEffectListXml,
	buildReflectionXml,
	buildSoftEdgeXml,
} from './shape-effect-secondary-xml-builders';

export interface PptxShapeEffectXmlBuilderContext {
	emuPerPx: number;
	clampUnitInterval: (value: number) => number;
}

export interface IPptxShapeEffectXmlBuilder {
	buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildPresetShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined;
}

export class PptxShapeEffectXmlBuilder implements IPptxShapeEffectXmlBuilder {
	private readonly context: PptxShapeEffectXmlBuilderContext;

	public constructor(context: PptxShapeEffectXmlBuilderContext) {
		this.context = context;
	}

	public buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const shadowColor = String(shapeStyle.shadowColor || '').trim();
		if (shadowColor.length === 0 || shadowColor === 'transparent') {
			return undefined;
		}

		const shadowOpacity =
			typeof shapeStyle.shadowOpacity === 'number' && Number.isFinite(shapeStyle.shadowOpacity)
				? this.context.clampUnitInterval(shapeStyle.shadowOpacity)
				: 0.35;

		const shadowBlur =
			typeof shapeStyle.shadowBlur === 'number' && Number.isFinite(shapeStyle.shadowBlur)
				? Math.max(0, shapeStyle.shadowBlur)
				: 6;

		// Prefer stored angle/distance if available, otherwise compute from offsets
		let distance: number;
		let directionDegrees: number;

		if (
			typeof shapeStyle.shadowAngle === 'number' &&
			typeof shapeStyle.shadowDistance === 'number'
		) {
			// Use stored values directly
			directionDegrees = shapeStyle.shadowAngle;
			distance = shapeStyle.shadowDistance;
		} else {
			// Compute from offsets (legacy path)
			const shadowOffsetX =
				typeof shapeStyle.shadowOffsetX === 'number' && Number.isFinite(shapeStyle.shadowOffsetX)
					? shapeStyle.shadowOffsetX
					: 4;
			const shadowOffsetY =
				typeof shapeStyle.shadowOffsetY === 'number' && Number.isFinite(shapeStyle.shadowOffsetY)
					? shapeStyle.shadowOffsetY
					: 4;

			distance = Math.sqrt(shadowOffsetX * shadowOffsetX + shadowOffsetY * shadowOffsetY);
			directionDegrees = ((Math.atan2(shadowOffsetY, shadowOffsetX) * 180) / Math.PI + 360) % 360;
		}

		const xmlObj: XmlObject = {
			'@_blurRad': String(Math.round(shadowBlur * this.context.emuPerPx)),
			'@_dist': String(Math.round(distance * this.context.emuPerPx)),
			'@_dir': String(Math.round(directionDegrees * 60000)),
			'a:srgbClr': {
				'@_val': shadowColor.replace('#', ''),
				'a:alpha': {
					'@_val': String(Math.round(shadowOpacity * 100000)),
				},
			},
		};

		// CT_OuterShadowEffect §20.1.8.45: sx, sy, kx, ky, algn
		if (typeof shapeStyle.shadowScaleX === 'number') {
			xmlObj['@_sx'] = String(Math.round(shapeStyle.shadowScaleX));
		}
		if (typeof shapeStyle.shadowScaleY === 'number') {
			xmlObj['@_sy'] = String(Math.round(shapeStyle.shadowScaleY));
		}
		if (typeof shapeStyle.shadowSkewX === 'number') {
			xmlObj['@_kx'] = String(Math.round(shapeStyle.shadowSkewX));
		}
		if (typeof shapeStyle.shadowSkewY === 'number') {
			xmlObj['@_ky'] = String(Math.round(shapeStyle.shadowSkewY));
		}
		if (shapeStyle.shadowAlignment) {
			xmlObj['@_algn'] = shapeStyle.shadowAlignment;
		}

		// Add rotateWithShape if explicitly set
		if (typeof shapeStyle.shadowRotateWithShape === 'boolean') {
			xmlObj['@_rotWithShape'] = shapeStyle.shadowRotateWithShape ? '1' : '0';
		}

		return xmlObj;
	}

	public buildPresetShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const preset = shapeStyle.presetShadowName;
		if (!preset || preset.length === 0) {
			return undefined;
		}
		const shadowColor = String(shapeStyle.shadowColor || '#000000').trim();

		const shadowOpacity =
			typeof shapeStyle.shadowOpacity === 'number' && Number.isFinite(shapeStyle.shadowOpacity)
				? this.context.clampUnitInterval(shapeStyle.shadowOpacity)
				: 0.5;

		// Prefer stored angle/distance; fall back to derived from offsets.
		let distance: number;
		let directionDegrees: number;
		if (
			typeof shapeStyle.shadowAngle === 'number' &&
			typeof shapeStyle.shadowDistance === 'number'
		) {
			directionDegrees = shapeStyle.shadowAngle;
			distance = shapeStyle.shadowDistance;
		} else {
			const ox = typeof shapeStyle.shadowOffsetX === 'number' ? shapeStyle.shadowOffsetX : 0;
			const oy = typeof shapeStyle.shadowOffsetY === 'number' ? shapeStyle.shadowOffsetY : 0;
			distance = Math.sqrt(ox * ox + oy * oy);
			directionDegrees = ((Math.atan2(oy, ox) * 180) / Math.PI + 360) % 360;
		}

		return {
			'@_prst': preset,
			'@_dist': String(Math.round(distance * this.context.emuPerPx)),
			'@_dir': String(Math.round(directionDegrees * 60000)),
			'a:srgbClr': {
				'@_val': shadowColor.replace('#', ''),
				'a:alpha': {
					'@_val': String(Math.round(shadowOpacity * 100000)),
				},
			},
		};
	}

	public buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const innerColor = String(shapeStyle.innerShadowColor || '').trim();
		if (innerColor.length === 0 || innerColor === 'transparent') {
			return undefined;
		}

		const offsetX =
			typeof shapeStyle.innerShadowOffsetX === 'number' &&
			Number.isFinite(shapeStyle.innerShadowOffsetX)
				? shapeStyle.innerShadowOffsetX
				: 0;
		const offsetY =
			typeof shapeStyle.innerShadowOffsetY === 'number' &&
			Number.isFinite(shapeStyle.innerShadowOffsetY)
				? shapeStyle.innerShadowOffsetY
				: 0;
		const blurValue =
			typeof shapeStyle.innerShadowBlur === 'number' && Number.isFinite(shapeStyle.innerShadowBlur)
				? Math.max(0, shapeStyle.innerShadowBlur)
				: 6;
		const opacity =
			typeof shapeStyle.innerShadowOpacity === 'number' &&
			Number.isFinite(shapeStyle.innerShadowOpacity)
				? this.context.clampUnitInterval(shapeStyle.innerShadowOpacity)
				: 0.5;

		const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
		const directionDegrees = ((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360;

		const xmlObj: XmlObject = {
			'@_blurRad': String(Math.round(blurValue * this.context.emuPerPx)),
			'@_dist': String(Math.round(distance * this.context.emuPerPx)),
			'@_dir': String(Math.round(directionDegrees * 60000)),
			'a:srgbClr': {
				'@_val': innerColor.replace('#', ''),
				'a:alpha': {
					'@_val': String(Math.round(opacity * 100000)),
				},
			},
		};

		if (typeof shapeStyle.innerShadowRotateWithShape === 'boolean') {
			xmlObj['@_rotWithShape'] = shapeStyle.innerShadowRotateWithShape ? '1' : '0';
		}

		return xmlObj;
	}

	public buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const glowColor = String(shapeStyle.glowColor || '').trim();
		if (glowColor.length === 0 || glowColor === 'transparent') {
			return undefined;
		}
		const glowRadius =
			typeof shapeStyle.glowRadius === 'number' &&
			Number.isFinite(shapeStyle.glowRadius) &&
			shapeStyle.glowRadius > 0
				? shapeStyle.glowRadius
				: undefined;
		if (glowRadius === undefined) {
			return undefined;
		}

		const glowOpacity =
			typeof shapeStyle.glowOpacity === 'number' && Number.isFinite(shapeStyle.glowOpacity)
				? this.context.clampUnitInterval(shapeStyle.glowOpacity)
				: 0.4;

		return {
			'@_rad': String(Math.round(glowRadius * this.context.emuPerPx)),
			'a:srgbClr': {
				'@_val': glowColor.replace('#', ''),
				'a:alpha': {
					'@_val': String(Math.round(glowOpacity * 100000)),
				},
			},
		};
	}

	public buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return buildSoftEdgeXml(shapeStyle, this.context.emuPerPx);
	}

	public buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return buildReflectionXml(shapeStyle, this.context);
	}

	public buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return buildBlurXml(shapeStyle, this.context.emuPerPx);
	}

	/**
	 * Build `a:effectLst` XML for line-level effects (shadow/glow on `a:ln`).
	 * Returns undefined if no line effects are defined.
	 */
	public buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return buildLineEffectListXml(shapeStyle, this.context);
	}
}
