import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import {
	getComputedImageStyle,
	getImageColorWashStyle,
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
	const imageStyle: StyleMap = {
		width: '100%',
		height: '100%',
		'object-fit': 'contain',
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

	return {
		imageStyle,
		svgFilters: computed.svgFilters,
		clrChange: getClrChangeParams(element),
		colorWashStyle,
	};
}
