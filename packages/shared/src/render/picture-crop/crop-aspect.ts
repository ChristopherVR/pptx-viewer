/**
 * Crop to Aspect Ratio, Fill and Fit: the three one-click crops under
 * PowerPoint's Picture Format > Crop dropdown.
 *
 * - Aspect ratio: the largest frame of that ratio that fits on the image,
 *   centred on it (the picture keeps its scale, the frame changes shape).
 * - Fill: the frame stays; the image is scaled, keeping its own proportions,
 *   until it covers the frame, centred, and the overflow is cropped.
 * - Fit: the frame stays; the image is scaled until all of it fits, centred,
 *   which pads the frame (negative `a:srcRect` insets).
 *
 * "The image's own proportions" are its natural pixel size when the binding
 * knows it (an `<img>`'s `naturalWidth/Height`), else the proportions it is
 * currently displayed at.
 *
 * @module render/picture-crop/crop-aspect
 */
import type { PptxElement } from 'pptx-viewer-core';

import { beginCropDrag, finishCropUpdate } from './crop-geometry';
import type { CropElementUpdate, CropRect } from './crop-geometry';

/** Which heading an aspect preset sits under in the menu. */
export type CropAspectGroup = 'square' | 'portrait' | 'landscape';

/** One Crop to Aspect Ratio preset. */
export interface CropAspectPreset {
	/** Stable id, also the label shown ("16:9"). */
	id: string;
	ratioWidth: number;
	ratioHeight: number;
	group: CropAspectGroup;
}

function preset(w: number, h: number): CropAspectPreset {
	return {
		id: `${w}:${h}`,
		ratioWidth: w,
		ratioHeight: h,
		group: w === h ? 'square' : w < h ? 'portrait' : 'landscape',
	};
}

/** PowerPoint's list, in its order. */
export const CROP_ASPECT_PRESETS: readonly CropAspectPreset[] = [
	preset(1, 1),
	preset(2, 3),
	preset(3, 4),
	preset(3, 5),
	preset(4, 5),
	preset(3, 2),
	preset(4, 3),
	preset(5, 3),
	preset(5, 4),
	preset(16, 9),
	preset(16, 10),
];

/** i18n keys for the three group headings. */
export const CROP_ASPECT_GROUP_LABEL_KEYS: Record<CropAspectGroup, string> = {
	square: 'pptx.image.cropSquare',
	portrait: 'pptx.image.cropPortrait',
	landscape: 'pptx.image.cropLandscape',
};

/** Optional natural size of the bitmap, for Fill and Fit. */
export interface NaturalImageSize {
	width: number;
	height: number;
}

function centred(around: CropRect, width: number, height: number): CropRect {
	return {
		x: around.x + (around.width - width) / 2,
		y: around.y + (around.height - height) / 2,
		width,
		height,
	};
}

/** Crop `el` to `ratioWidth:ratioHeight`, centred on the image. */
export function cropToAspectRatio(
	el: PptxElement,
	ratioWidth: number,
	ratioHeight: number,
): CropElementUpdate {
	const start = beginCropDrag(el);
	const { image } = start;
	const ratio = ratioWidth / ratioHeight;
	const width = Math.min(image.width, image.height * ratio);
	const height = width / ratio;
	return finishCropUpdate(start, centred(image, width, height), image);
}

function imageAspect(start: ReturnType<typeof beginCropDrag>, natural?: NaturalImageSize): number {
	if (natural && natural.width > 0 && natural.height > 0) {
		return natural.width / natural.height;
	}
	return start.image.width / start.image.height;
}

/** Fill: scale the image to cover the frame, centred. */
export function cropFill(el: PptxElement, natural?: NaturalImageSize): CropElementUpdate {
	const start = beginCropDrag(el);
	const aspect = imageAspect(start, natural);
	const { frame } = start;
	const width = Math.max(frame.width, frame.height * aspect);
	return finishCropUpdate(start, frame, centred(frame, width, width / aspect));
}

/** Fit: scale the image to fit inside the frame, centred (pads the frame). */
export function cropFit(el: PptxElement, natural?: NaturalImageSize): CropElementUpdate {
	const start = beginCropDrag(el);
	const aspect = imageAspect(start, natural);
	const { frame } = start;
	const width = Math.min(frame.width, frame.height * aspect);
	return finishCropUpdate(start, frame, centred(frame, width, width / aspect));
}
