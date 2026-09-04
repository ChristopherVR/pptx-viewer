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
	 * The mask for the picture's stationary frame container: the picture's own
	 * shape geometry (`p:spPr/a:prstGeom` / `a:custGeom`) - `border-radius` for
	 * the roundRect family and ellipse presets, a rescaled `clip-path` for
	 * custGeom and other silhouettes - with the authored Crop-to-Shape clip as
	 * the fallback. `undefined` for effectively rectangular pictures, where the
	 * frame's overflow clipping already expresses the geometry. Kept off the
	 * `<img>`, whose source-crop transform would scale and shift a pixel-space
	 * clip.
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

/**
 * The mask for the picture's stationary frame container: the picture's own
 * shape geometry (see {@link getAngularImageGeometryMask}), with the authored
 * Crop-to-Shape clip as the fallback when the geometry resolves to no
 * `clip-path` (e.g. roundRect, whose border-radius already rounds the frame).
 * The mask must stay off the `<img>`: a cropped picture paints by
 * transforming that same img, and a pixel-space clip would be scaled and
 * shifted along with it.
 */
export function buildAngularImageContainerMask(element: PptxElement): StyleMap | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	const geometryMask = getAngularImageGeometryMask(element);
	const cropShapeClipPath = getImageCropShapeClipPath(element);
	return {
		...(geometryMask ?? {}),
		...(geometryMask?.['clip-path'] || !cropShapeClipPath
			? {}
			: { 'clip-path': cropShapeClipPath }),
	};
}

/** Build the complete shared image-effect view consumed by Angular templates. */
export function buildAngularImageRenderView(element: PptxElement): AngularImageRenderView {
	const computed = getComputedImageStyle(element);
	// The fill/crop fit comes from shared so the `<a:srcRect>` source crop is the
	// same maths in every binding; `[ngStyle]` accepts its camelCase keys. The
	// geometry/crop mask does NOT ride the `<img>`: a cropped picture paints by
	// transforming that same img, and a pixel-space clip would be scaled and
	// shifted along with it - the mask belongs on the frame container (see
	// `buildAngularImageContainerMask`).
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
	const frameGeometryMask = buildAngularImageContainerMask(element);

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
			}
		: undefined;

	return {
		imageStyle,
		svgFilters: computed.svgFilters,
		clrChange: getClrChangeParams(element),
		colorWashStyle,
		tilingStyle,
		frameGeometryMask,
	};
}
