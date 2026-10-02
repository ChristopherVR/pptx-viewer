import type { PptxElement } from 'pptx-viewer-core';
import { cropFill, cropFit, cropToAspectRatio, parseCropValue } from 'pptx-viewer-shared';
import type { CropElementUpdate, NaturalImageSize } from 'pptx-viewer-shared';

/** The rendered bitmap's natural size, when its <img> is on the canvas. */
function naturalSizeOf(element: PptxElement): NaturalImageSize | undefined {
	const img =
		typeof document === 'undefined'
			? null
			: document.querySelector<HTMLImageElement>(
					`[data-element-id="${CSS.escape(element.id)}"] img`,
				);
	return img && img.naturalWidth > 0 && img.naturalHeight > 0
		? { width: img.naturalWidth, height: img.naturalHeight }
		: undefined;
}

/** The crop update a Crop menu value stands for (aspect ratio, Fill or Fit), if any. */
export function cropUpdateFor(
	element: PptxElement,
	value: string | number | undefined,
): CropElementUpdate | undefined {
	const action = parseCropValue(value);
	if (!action) {
		return undefined;
	}
	if (action.kind === 'aspect') {
		return cropToAspectRatio(element, action.width, action.height);
	}
	return action.kind === 'fill'
		? cropFill(element, naturalSizeOf(element))
		: cropFit(element, naturalSizeOf(element));
}
