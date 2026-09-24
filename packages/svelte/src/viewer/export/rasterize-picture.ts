import type { PptxElement } from 'pptx-viewer-core';
import {
	buildRasterPictureElement,
	findCanvasElementNode,
	rasterizeElementToDataUrl,
} from 'pptx-viewer-shared';

import { renderToCanvas } from './render-to-canvas';

/**
 * Paste Special / Paste Options's "Picture" format: rasterise the already-
 * mounted node for `elementId` and build the resulting picture element, or
 * `null` when the node is not on screen (e.g. the toolbar outlived a slide
 * change). Shares the same `rasterizeElementToDataUrl` + `renderToCanvas`
 * pipeline `save-element-as-picture.ts` already goes through.
 *
 * @param elementId - The pasted element's id (its `[data-element-id]` node).
 * @param sourceClone - The pristine "Keep Source Formatting" clone to build the
 *   picture's id/position/rotation from.
 */
export async function rasterizePastedElementAsPicture(
	elementId: string,
	sourceClone: PptxElement,
): Promise<PptxElement | null> {
	const node = findCanvasElementNode(document, elementId);
	if (!node) {
		return null;
	}
	const rect = node.getBoundingClientRect();
	const width = rect.width || node.offsetWidth;
	const height = rect.height || node.offsetHeight;
	const dataUrl = await rasterizeElementToDataUrl(node, width, height, document, {
		scale: 2,
		html2canvasFallback: (sourceRect, outputSize) =>
			renderToCanvas(node, {
				scale: outputSize.width / (sourceRect.width || 1),
				x: sourceRect.x,
				y: sourceRect.y,
				width: sourceRect.width,
				height: sourceRect.height,
				useCORS: true,
				allowTaint: true,
				logging: false,
			}),
	});
	return buildRasterPictureElement(sourceClone, dataUrl);
}
