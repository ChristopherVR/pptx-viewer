import type { PptxElement } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { buildActionButtonElement } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factory for the Insert > Action Button action: wraps the shared
 * `buildActionButtonElement` (one of the 12 OOXML built-in action-button
 * presets, `action-buttons.ts`) and centres the result on the slide canvas.
 */

/**
 * Build a new, centred action-button shape from the shared preset catalogue,
 * or `null` when `shapeType` isn't a known action-button preset.
 */
export function buildActionButtonInsertElement(
	shapeType: string,
	canvasSize: CanvasSize,
): PptxElement | null {
	const el = buildActionButtonElement(shapeType, '');
	if (!el) {
		return null;
	}
	centerOnCanvas(el, canvasSize);
	return el;
}
