import {
	elementPictureFilename,
	findCanvasElementNode,
	saveElementAsPicture,
} from 'pptx-viewer-shared';

import { renderToCanvas } from './render-to-canvas';

/**
 * "Save as Picture" (element context-menu command): find the right-clicked
 * element's own mounted DOM node and rasterise + download just that node,
 * via the shared `saveElementAsPicture` pipeline this package's slide export
 * already goes through (`rasterize-slide.ts`'s own `html2canvasFallback`
 * closures follow the same `renderToCanvas` wrapping).
 *
 * A no-op when the element is not currently mounted (e.g. the menu outlived
 * a slide change), same as every other context-menu command that reads the
 * DOM.
 *
 * @param elementId - The right-clicked element's id.
 * @param elementName - The element's own `name`, for the download filename.
 * @param fallbackLabel - Translated fallback label when `elementName` is empty.
 */
export async function saveContextMenuElementAsPicture(
	elementId: string,
	elementName: string | undefined,
	fallbackLabel: string,
): Promise<void> {
	const node = findCanvasElementNode(document, elementId);
	if (!node) {
		return;
	}
	const rect = node.getBoundingClientRect();
	const width = rect.width || node.offsetWidth;
	const height = rect.height || node.offsetHeight;
	await saveElementAsPicture(
		node,
		width,
		height,
		document,
		elementPictureFilename(elementName, fallbackLabel),
		{
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
		},
	);
}
