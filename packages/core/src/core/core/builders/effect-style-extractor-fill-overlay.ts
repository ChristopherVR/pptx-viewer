import type { ShapeStyle, XmlObject } from '../../types';
import { effectChild } from './effect-list-roundtrip';
import { fillOverlayColorHost } from './PptxEffectDagExtractor';

const VALID_FILL_OVERLAY_BLENDS = new Set(['over', 'mult', 'screen', 'darken', 'lighten']);

/** Context {@link extractFillOverlayAttributes} needs from the owning extractor. */
export interface FillOverlayExtractorContext {
	emuPerPx: number;
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
	ensureArray: (value: unknown) => XmlObject[];
}

/**
 * `a:fillOverlay` as a DIRECT child of the plain `a:effectLst` (D1-G3:
 * CT_EffectList §20.1.8.24 lists it as a legal sibling of shadow/glow/blur/
 * etc), distinct from the effectDag form handled by `PptxEffectDagExtractor`,
 * and from the blip-level `a:blip/a:fillOverlay` handled by
 * `PptxHandlerRuntimeImageEffects`. Reuses the DAG extractor's colour-host
 * resolution (solid fill, or first gradient stop) so both call sites treat
 * the overlay's fill child the same way.
 *
 * Split out of `PptxShapeEffectStyleExtractor` (at the 300-line file-size
 * limit) mirroring how `extractReflectionAttributes` already lives in its
 * own module for the same reason.
 */
export function extractFillOverlayAttributes(
	shapeProps: XmlObject,
	context: FillOverlayExtractorContext,
): Partial<ShapeStyle> {
	const effectList = effectChild(shapeProps, 'effectLst');
	const fillOverlay = effectChild(effectList, 'fillOverlay');
	if (!fillOverlay) {
		return {};
	}

	const style: Partial<ShapeStyle> = {};

	const blend = String(fillOverlay['@_blend'] || '')
		.trim()
		.toLowerCase();
	if (VALID_FILL_OVERLAY_BLENDS.has(blend)) {
		style.shapeFillOverlayBlend = blend as ShapeStyle['shapeFillOverlayBlend'];
	}

	const colorHost = fillOverlayColorHost(fillOverlay, context);
	if (colorHost) {
		const color = context.parseColor(colorHost);
		if (color) {
			style.shapeFillOverlayColor = color;
			const opacity = context.extractColorOpacity(colorHost);
			if (typeof opacity === 'number' && Number.isFinite(opacity)) {
				style.shapeFillOverlayOpacity = opacity;
			}
		}
	}

	if (Object.keys(style).length === 0) {
		return {};
	}

	return { ...style, effectListXml: effectList, fillOverlayXml: fillOverlay };
}
