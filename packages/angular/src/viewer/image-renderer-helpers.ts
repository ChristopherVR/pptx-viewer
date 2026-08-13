import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import {
	getComputedImageStyle,
	getImageColorWashStyle,
	getImageFitStyle,
	getImageTilingStyle,
	getResolvedShapeClipPathFor,
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
	/**
	 * `a:blipFill/a:tile`: a repeating TEXTURE, which an `<img>` cannot express,
	 * so the picture paints as a repeating background layer instead. Undefined
	 * for an ordinary picture, which keeps the `<img>` branch.
	 */
	tilingStyle: StyleMap | undefined;
}

export function getImageCropShapeClipPath(element: PptxElement): string | undefined {
	if (!isImageLikeElement(element) || !element.cropShape || element.cropShape === 'none') {
		return undefined;
	}
	const shapeType =
		element.cropShape === 'roundedRect'
			? 'roundRect'
			: element.cropShape === 'star'
				? 'star5'
				: element.cropShape;
	return getResolvedShapeClipPathFor(shapeType, element.width, element.height);
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
	};
}
