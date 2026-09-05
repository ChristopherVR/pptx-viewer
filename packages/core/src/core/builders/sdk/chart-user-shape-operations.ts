/**
 * Headless chart drawing-overlay (`c:userShapes`) mutation operations for
 * the PPTX SDK.
 *
 * Like every other function in `./chart-operations`, these mutate
 * {@link ChartPptxElement}'s `chartData` in place; no XML/ZIP work happens
 * here. The save pipeline (`PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml`)
 * detects that `chartData.userShapes` no longer matches what is on disk and
 * (re)writes the drawing part automatically.
 *
 * @module sdk/chart-user-shape-operations
 */

import type { PptxChartUserShape } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';

function ensureChartData(
	element: ChartPptxElement,
): asserts element is ChartPptxElement & { chartData: NonNullable<ChartPptxElement['chartData']> } {
	if (!element.chartData) {
		throw new Error(
			'Chart element has no chartData. Cannot perform chart operations on an uninitialised chart.',
		);
	}
}

function validateShapeIndex(element: ChartPptxElement, index: number): void {
	ensureChartData(element);
	const count = element.chartData.userShapes?.length ?? 0;
	if (index < 0 || index >= count) {
		throw new RangeError(
			`Overlay-shape index ${index} is out of range. Chart has ${count} overlay shape(s) (indices 0-${count - 1}).`,
		);
	}
}

/**
 * List a chart's drawing-overlay shapes (`c:userShapes`), in document order.
 *
 * @param element - The chart element to read.
 * @returns The overlay shapes, or an empty array when the chart has none.
 */
export function listChartUserShapes(element: ChartPptxElement): PptxChartUserShape[] {
	return element.chartData?.userShapes ?? [];
}

/**
 * Append a new drawing-overlay shape to a chart.
 *
 * @param element - The chart element to modify.
 * @param shape - The complete overlay shape to add (see
 *   `pptx-viewer-shared`'s `createDefaultChartUserShape` for a ready-made
 *   text-box default).
 *
 * @example
 * ```ts
 * addChartUserShape(chartEl, {
 *   kind: "sp",
 *   anchor: "rel",
 *   from: { x: 0.1, y: 0.1 },
 *   to: { x: 0.4, y: 0.25 },
 *   fill: "#FFFF00",
 *   paragraphs: [{ text: "Note" }],
 * });
 * ```
 */
export function addChartUserShape(element: ChartPptxElement, shape: PptxChartUserShape): void {
	ensureChartData(element);
	const existing = element.chartData.userShapes ?? [];
	element.chartData.userShapes = [...existing, shape];
}

/**
 * Patch one drawing-overlay shape's anchor and/or visual properties.
 *
 * @param element - The chart element to modify.
 * @param index - Index of the overlay shape in `listChartUserShapes` order.
 * @param patch - Fields to overwrite; anything omitted is left as-is.
 */
export function updateChartUserShape(
	element: ChartPptxElement,
	index: number,
	patch: Partial<PptxChartUserShape>,
): void {
	validateShapeIndex(element, index);
	const shapes = element.chartData!.userShapes!;
	element.chartData!.userShapes = shapes.map((shape, i) =>
		i === index ? { ...shape, ...patch } : shape,
	);
}

/**
 * Remove a drawing-overlay shape from a chart by index.
 *
 * @param element - The chart element to modify.
 * @param index - Index of the overlay shape to remove.
 */
export function removeChartUserShape(element: ChartPptxElement, index: number): void {
	validateShapeIndex(element, index);
	const shapes = element.chartData!.userShapes!;
	element.chartData!.userShapes = shapes.filter((_, i) => i !== index);
}
