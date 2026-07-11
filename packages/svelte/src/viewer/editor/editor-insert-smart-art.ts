import type { PptxElement, SmartArtLayout } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { buildSmartArtPresetData } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factory for the Insert > SmartArt action: wraps the shared
 * `buildSmartArtPresetData` factory (layout + default node texts, from the
 * `smart-art-presets.ts` gallery catalogue) and centres the result on the
 * slide canvas.
 */

/** Default box size (px) for a freshly-inserted SmartArt diagram. */
const SMARTART_SIZE = { width: 600, height: 340 };

/**
 * Build a new, centred SmartArt element from a gallery preset (layout +
 * default node texts).
 */
export function buildSmartArtInsertElement(
	layout: SmartArtLayout,
	defaultItems: string[],
	canvasSize: CanvasSize,
): PptxElement {
	const el = {
		id: '',
		type: 'smartArt',
		name: 'SmartArt',
		x: 0,
		y: 0,
		width: SMARTART_SIZE.width,
		height: SMARTART_SIZE.height,
		smartArtData: buildSmartArtPresetData(layout, defaultItems, (i) => `smartart-node-${i}`),
	} as unknown as PptxElement;
	centerOnCanvas(el, canvasSize);
	return el;
}
