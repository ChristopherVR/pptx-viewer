/**
 * The pure, three-free description of a 3D chart that `<pptx-three-view>`
 * mounts (`kind: 'chart'`). Built from a chart element by
 * `buildChart3DSpec`; consumed by `chart-3d-view-scene.ts`.
 *
 * PLACEHOLDER: the chart-engine track replaces this with the full spec.
 *
 * @module chart-3d-spec
 */
import type { PptxElement } from 'pptx-viewer-core';

export interface Chart3DSpec {
	/** The chart element the spec was built from (identity drives remounts). */
	element: PptxElement;
	width: number;
	height: number;
}

/** The chart types the 3D chart scene renders. */
export const CHART_3D_TYPES: ReadonlySet<string> = new Set([
	'bar3D',
	'line3D',
	'area3D',
	'pie3D',
	'surface',
]);

/** Build the 3D spec for a chart element, or `null` when it is not a 3D chart. */
export function buildChart3DSpecForElement(element: PptxElement): Chart3DSpec | null {
	if (element.type !== 'chart' || !CHART_3D_TYPES.has(element.chartData?.chartType ?? '')) {
		return null;
	}
	return { element, width: element.width, height: element.height };
}
