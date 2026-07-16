import { XmlObject, TextStyle, TextSegment, ShapeStyle } from '../../types';
import type { PptxImageLikeElement, PptxImageEffects } from '../../types';
import { applyImageAlphaEffects } from './image-alpha-effects';
import { applyImageColorEffects } from './image-color-effects';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveShapeXml';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected clampCropForSave(value: unknown): number {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return 0;
		}
		return Math.max(0, Math.min(0.95, value));
	}

	protected applyImageCropToBlipFill(
		blipFill: XmlObject | undefined,
		element: PptxImageLikeElement,
	): void {
		if (!blipFill) {
			return;
		}

		const cropLeft = this.clampCropForSave(element.cropLeft);
		const cropTop = this.clampCropForSave(element.cropTop);
		const cropRight = this.clampCropForSave(element.cropRight);
		const cropBottom = this.clampCropForSave(element.cropBottom);

		const horizontalCrop = cropLeft + cropRight;
		const verticalCrop = cropTop + cropBottom;
		const hasCrop = horizontalCrop > 0.0001 || verticalCrop > 0.0001;

		if (!hasCrop) {
			delete blipFill['a:srcRect'];
			return;
		}

		const safeHorizontalScale = horizontalCrop >= 0.99 ? 0.99 / horizontalCrop : 1;
		const safeVerticalScale = verticalCrop >= 0.99 ? 0.99 / verticalCrop : 1;
		const normalizedLeft = this.clampCropForSave(cropLeft * safeHorizontalScale);
		const normalizedRight = this.clampCropForSave(cropRight * safeHorizontalScale);
		const normalizedTop = this.clampCropForSave(cropTop * safeVerticalScale);
		const normalizedBottom = this.clampCropForSave(cropBottom * safeVerticalScale);

		blipFill['a:srcRect'] = {
			'@_l': String(Math.round(normalizedLeft * 100000)),
			'@_t': String(Math.round(normalizedTop * 100000)),
			'@_r': String(Math.round(normalizedRight * 100000)),
			'@_b': String(Math.round(normalizedBottom * 100000)),
		};
	}

	protected applyImageEffectsToBlip(
		blipFill: XmlObject | undefined,
		effects: PptxImageEffects | undefined,
	): void {
		if (!blipFill) {
			return;
		}
		const blip = blipFill['a:blip'] as XmlObject | undefined;
		if (!blip) {
			return;
		}
		const nextEffects = effects ?? {};

		if (typeof nextEffects.brightness === 'number' && Number.isFinite(nextEffects.brightness)) {
			blip['@_bright'] = String(Math.round(nextEffects.brightness * 1000));
		} else {
			delete blip['@_bright'];
			delete blip['@_brt'];
		}

		if (typeof nextEffects.contrast === 'number' && Number.isFinite(nextEffects.contrast)) {
			blip['@_contrast'] = String(Math.round(nextEffects.contrast * 1000));
		} else {
			delete blip['@_contrast'];
			delete blip['@_cont'];
		}

		applyImageColorEffects(
			blip,
			nextEffects,
			(node) => this.parseColor(node),
			(node) => this.extractColorOpacity(node),
		);

		applyImageAlphaEffects(blip, nextEffects, (node) => this.parseColor(node));

		// a:lum
		if (nextEffects.lum) {
			const node: XmlObject = {};
			if (typeof nextEffects.lum.bright === 'number' && Number.isFinite(nextEffects.lum.bright)) {
				node['@_bright'] = String(Math.round(nextEffects.lum.bright * 1000));
			}
			if (
				typeof nextEffects.lum.contrast === 'number' &&
				Number.isFinite(nextEffects.lum.contrast)
			) {
				node['@_contrast'] = String(Math.round(nextEffects.lum.contrast * 1000));
			}
			blip['a:lum'] = node;
		} else {
			delete blip['a:lum'];
		}

		// a:hsl
		if (nextEffects.hsl) {
			const node: XmlObject = {};
			if (typeof nextEffects.hsl.hue === 'number' && Number.isFinite(nextEffects.hsl.hue)) {
				node['@_hue'] = String(Math.round(nextEffects.hsl.hue * 60000));
			}
			if (typeof nextEffects.hsl.sat === 'number' && Number.isFinite(nextEffects.hsl.sat)) {
				node['@_sat'] = String(Math.round(nextEffects.hsl.sat * 1000));
			}
			if (typeof nextEffects.hsl.lum === 'number' && Number.isFinite(nextEffects.hsl.lum)) {
				node['@_lum'] = String(Math.round(nextEffects.hsl.lum * 1000));
			}
			blip['a:hsl'] = node;
		} else {
			delete blip['a:hsl'];
		}

		// a:tint (image effect)
		if (nextEffects.tint) {
			const node: XmlObject = {};
			if (typeof nextEffects.tint.hue === 'number' && Number.isFinite(nextEffects.tint.hue)) {
				node['@_hue'] = String(Math.round(nextEffects.tint.hue * 60000));
			}
			if (typeof nextEffects.tint.amt === 'number' && Number.isFinite(nextEffects.tint.amt)) {
				node['@_amt'] = String(Math.round(nextEffects.tint.amt * 1000));
			}
			blip['a:tint'] = node;
		} else {
			delete blip['a:tint'];
		}

		// a:fillOverlay — preserve inner fill XML opaquely
		if (nextEffects.fillOverlay) {
			const node: XmlObject = {
				'@_blend': nextEffects.fillOverlay.blend,
			};
			if (nextEffects.fillOverlay.fillRawXml) {
				for (const key of Object.keys(nextEffects.fillOverlay.fillRawXml)) {
					node[key] = (nextEffects.fillOverlay.fillRawXml as Record<string, unknown>)[
						key
					] as XmlObject[keyof XmlObject];
				}
			}
			blip['a:fillOverlay'] = node;
		} else {
			delete blip['a:fillOverlay'];
		}

		// a:blur
		if (nextEffects.blur) {
			const node: XmlObject = {};
			if (typeof nextEffects.blur.rad === 'number' && Number.isFinite(nextEffects.blur.rad)) {
				node['@_rad'] = String(Math.round(nextEffects.blur.rad));
			}
			if (typeof nextEffects.blur.grow === 'boolean') {
				node['@_grow'] = nextEffects.blur.grow ? '1' : '0';
			}
			blip['a:blur'] = node;
		} else {
			delete blip['a:blur'];
		}
	}

	protected normalizePresetGeometry(shapeType: string | undefined): string {
		return this.elementXmlBuilder.normalizePresetGeometry(shapeType);
	}

	protected buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildGradientFillXml(shapeStyle);
	}

	protected clampUnitInterval(value: number): number {
		return this.colorStyleCodec.clampUnitInterval(value);
	}

	protected buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildOuterShadowXml(shapeStyle);
	}

	protected buildPresetShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildPresetShadowXml(shapeStyle);
	}

	protected buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildInnerShadowXml(shapeStyle);
	}

	protected buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildGlowXml(shapeStyle);
	}

	protected buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildSoftEdgeXml(shapeStyle);
	}

	protected buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildReflectionXml(shapeStyle);
	}

	protected buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildBlurXml(shapeStyle);
	}

	protected buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.colorStyleCodec.buildLineEffectListXml(shapeStyle);
	}

	protected textVerticalAlignToDrawingValue(
		vAlign: TextStyle['vAlign'] | undefined,
	): string | undefined {
		if (vAlign === 'top') {
			return 't';
		}
		if (vAlign === 'middle') {
			return 'ctr';
		}
		if (vAlign === 'bottom') {
			return 'b';
		}
		return undefined;
	}

	protected textDirectionToDrawingValue(
		value: TextStyle['textDirection'] | undefined,
	): string | undefined {
		if (value === 'vertical') {
			return 'vert';
		}
		if (value === 'vertical270') {
			return 'vert270';
		}
		if (value === 'eaVert') {
			return 'eaVert';
		}
		if (value === 'wordArtVert') {
			return 'wordArtVert';
		}
		if (value === 'wordArtVertRtl') {
			return 'wordArtVertRtl';
		}
		if (value === 'mongolianVert') {
			return 'mongolianVert';
		}
		return undefined;
	}

	protected normalizeTextColumnCount(value: unknown): number | undefined {
		const parsed =
			typeof value === 'number' && Number.isFinite(value)
				? value
				: Number.parseInt(String(value ?? ''), 10);
		if (!Number.isFinite(parsed)) {
			return undefined;
		}
		return Math.max(1, Math.min(16, Math.round(parsed)));
	}

	protected normalizeTextLineBreaks(value: string): string {
		return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	}

	protected getTextValueForSave(
		text: string | undefined,
		textSegments: TextSegment[] | undefined,
	): string {
		if (typeof text === 'string') {
			return this.normalizeTextLineBreaks(text);
		}
		if (!textSegments || textSegments.length === 0) {
			return '';
		}
		return this.normalizeTextLineBreaks(
			textSegments.map((segment) => String(segment.text || '')).join(''),
		);
	}
}
