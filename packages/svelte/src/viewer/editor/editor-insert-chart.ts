import type { PptxChartType, PptxElement } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { createDefaultChartElement } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factory for the Insert > Chart action: wraps the shared
 * `createDefaultChartElement` (fully-populated sample data, ready to render)
 * and centres the result on the slide canvas.
 */

/** Build a new, centred chart element for the given chart type. */
export function buildChartInsertElement(
	chartType: PptxChartType,
	canvasSize: CanvasSize,
): PptxElement {
	const el: PptxElement = createDefaultChartElement(chartType);
	centerOnCanvas(el, canvasSize);
	return el;
}
