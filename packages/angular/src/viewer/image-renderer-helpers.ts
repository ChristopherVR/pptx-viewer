import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import {
	getComputedImageStyle,
	getCropShapeClipPath,
	getImageColorWashStyle,
	getImageFitStyle,
	getImageTilingStyle,
	resolveShapeGeometry,
} from '../internal/shared';
import type { ImageSvgFilterDefinition } from '../internal/shared';
import { getClrChangeParams } from './color-changed-image-helpers';
import type { ClrChangeParams } from './color-changed-image-helpers';
import type { StyleMap } from './element-style';

export interface AngularImageRenderView {
	imageStyle: StyleMap;
	svgFilters: ImageSvgFilterDefinition[];
	clrChange: ClrChangeParams | undefined;
	colorWashStyle: StyleMap | undefined;
	tilingStyle: StyleMap | undefined;
	/**
	 * The picture's own shape geometry as a mask for the stationary frame
	 * container (see {@link getAngularImageGeometryMask}). `undefined` for
	 * effectively rectangular pictures, where the frame's overflow clipping
	 * already expresses the geometry.
	 */
	frameGeometryMask: StyleMap | undefined;
}

export function getImageCropShapeClipPath(element: PptxElement): string | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	return getCropShapeClipPath(element.cropShape, element.width, element.height);
}

/**
 * The picture's own shape geometry as a mask for the stationary frame
 * container: `border-radius` for the roundRect family and ellipse presets, a
 * rescaled `clip-path` for custGeom and other silhouettes. The authored
 * Crop-to-Shape clip is the fallback.
 */
export function getAngularImageGeometryMask(element: PptxElement): StyleMap | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	const geometry = resolveShapeGeometry(element);
	if (geometry.kind === 'borderRadius') {
		return { 'border-radius': geometry.radius };
	}
	return geometry.kind === 'clipPath' ? { 'clip-path': geometry.clipPath } : undefined;
}

/** Build the complete shared image-effect view consumed by Angular templates. */
export function buildAngularImageRenderView(element: PptxElement): AngularImageRenderView {
	const computed = getComputedImageStyle(element);
	// The fill/crop fit comes from shared so the `<a:srcRect>` source crop is the
	// same maths in every binding; `[ngStyle]` accepts its camelCase keys.
	const imageStyle: StyleMap = {
		...getImageFitStyle(element),
		display: 'block',
	};
	if (computed.filter) {
		imageStyle.filter = computed.filter;
	}
	if (computed.opacity !== undefined) {
		imageStyle.opacity = computed.opacity;
	}
	const geometryMask = getAngularImageGeometryMask(element);
	const cropShapeClipPath = getImageCropShapeClipPath(element);
	if (cropShapeClipPath) {
		imageStyle['clip-path'] = cropShapeClipPath;
	}

	const colorWash = getImageColorWashStyle(
		isImageLikeElement(element) ? element.imageEffects?.colorWash : undefined,
	);
	const colorWashStyle: StyleMap | undefined = colorWash
		? {
				position: 'absolute',
				inset: 0,
				'pointer-events': 'none',
				'background-color': colorWash.backgroundColor,
				opacity: colorWash.opacity,
				...(cropShapeClipPath ? { 'clip-path': cropShapeClipPath } : {}),
			}
		: undefined;

	// A tiled picture (`a:blipFill/a:tile`, with its `@sx`/`@sy` scale,
	// `@tx`/`@ty` offset, `@algn` anchor and `@flip` mirroring) is painted as a
	// repeating background by every binding, because an `<img>` cannot repeat.
	// Angular rendered it as ONE stretched copy until this branch existed.
	const tiling = getImageTilingStyle(element);
	const tilingStyle: StyleMap | undefined = tiling
		? {
				...(tiling as StyleMap),
				...(computed.filter ? { filter: computed.filter } : {}),
				...(computed.opacity !== undefined ? { opacity: computed.opacity } : {}),
				...(cropShapeClipPath ? { 'clip-path': cropShapeClipPath } : {}),
			}
		: undefined;

	return {
		imageStyle,
		svgFilters: computed.svgFilters,
		clrChange: getClrChangeParams(element),
		colorWashStyle,
		tilingStyle,
		frameGeometryMask: geometryMask,
	};
}
