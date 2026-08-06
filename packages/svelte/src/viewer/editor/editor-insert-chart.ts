import type { PptxChartType, PptxElement } from 'pptx-viewer-core';
import type { CanvasSize, InsertChartKind } from 'pptx-viewer-shared';
import { createDefaultChartElement } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factory for the Insert > Chart action: wraps the shared
 * `createDefaultChartElement` (fully-populated sample data, ready to render)
 * and centres the result on the slide canvas.
 */

/**
 * Build a new, centred chart element for the given insert-dropdown entry.
 * `'column'` yields vertical columns, `'bar'` horizontal bars; a raw
 * `PptxChartType` is still accepted for API callers.
 */
export function buildChartInsertElement(
	chartKind: InsertChartKind | PptxChartType,
	canvasSize: CanvasSize,
): PptxElement {
	const el: PptxElement = createDefaultChartElement(chartKind);
	centerOnCanvas(el, canvasSize);
	return el;
}
