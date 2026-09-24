/**
 * Which `<pptx-three-view>` spec (if any) a chart or SmartArt element gets,
 * decided once for every binding.
 *
 * The six public opt-in flags keep their historical meaning: `barChart3D`
 * covers `bar3D`, `lineChart3D` covers `line3D`, `areaChart3D` covers
 * `area3D`, `pieChart3D` covers `pie3D`, `surfaceChart3D` covers `surface`,
 * and `smartArt3D` covers every SmartArt graphic. A plain 2D chart never
 * picks up its 3D sibling: the flags gate on the RAW `c:chartType`.
 *
 * Specs are memoised per element object, so a binding that re-renders with
 * the same element hands the element the same spec object and the view never
 * remounts; a new element object (the data changed) yields a new spec.
 *
 * @module three-view/view-spec
 */
import type { PptxElement } from 'pptx-viewer-core';

import { buildChart3DSpecForElement } from '../render/chart-3d-spec';
import type { Rendering3DFlags } from '../render/options/viewer-options-apply';
import { buildSmartArt3DSpecForElement } from '../render/smartart-3d-element';
import type { ThreeViewSpec } from './types';

/** The five chart flags of {@link Rendering3DFlags}. */
export type Chart3DFlags = Pick<
	Rendering3DFlags,
	'barChart3D' | 'lineChart3D' | 'areaChart3D' | 'pieChart3D' | 'surfaceChart3D'
>;

/** Whether the host opted this raw `c:chartType` into the 3D view. */
export function isChart3DViewEnabled(
	flags: Partial<Chart3DFlags> | null | undefined,
	chartType: string | undefined,
): boolean {
	if (!flags || !chartType) {
		return false;
	}
	switch (chartType) {
		case 'bar3D':
			return Boolean(flags.barChart3D);
		case 'line3D':
			return Boolean(flags.lineChart3D);
		case 'area3D':
			return Boolean(flags.areaChart3D);
		case 'pie3D':
			return Boolean(flags.pieChart3D);
		case 'surface':
			return Boolean(flags.surfaceChart3D);
		default:
			return false;
	}
}

const chartSpecs = new WeakMap<PptxElement, ThreeViewSpec | null>();
const smartArtSpecs = new WeakMap<PptxElement, ThreeViewSpec | null>();

/** The (memoised) chart spec for an element, ignoring flags; `null` when it is not a 3D chart. */
export function chartThreeViewSpec(element: PptxElement): ThreeViewSpec | null {
	if (chartSpecs.has(element)) {
		return chartSpecs.get(element) ?? null;
	}
	const spec = buildChart3DSpecForElement(element);
	const view: ThreeViewSpec | null = spec ? { kind: 'chart', spec } : null;
	chartSpecs.set(element, view);
	return view;
}

/** The (memoised) SmartArt spec for an element; `null` when it has nothing to draw. */
export function smartArtThreeViewSpec(element: PptxElement): ThreeViewSpec | null {
	if (smartArtSpecs.has(element)) {
		return smartArtSpecs.get(element) ?? null;
	}
	const spec = buildSmartArt3DSpecForElement(element);
	const view: ThreeViewSpec | null = spec ? { kind: 'smartart', spec } : null;
	smartArtSpecs.set(element, view);
	return view;
}

/**
 * The spec a chart element's `<pptx-three-view>` gets, or `null` for the
 * plain 2D path (flag off for this chart type, or no 3D spec).
 */
export function resolveChartThreeViewSpec(
	element: PptxElement,
	flags: Partial<Chart3DFlags> | null | undefined,
): ThreeViewSpec | null {
	if (element.type !== 'chart' || !isChart3DViewEnabled(flags, element.chartData?.chartType)) {
		return null;
	}
	return chartThreeViewSpec(element);
}

/**
 * The spec a SmartArt element's `<pptx-three-view>` gets, or `null` for the
 * plain 2D path (`smartArt3D` off, or nothing to draw).
 */
export function resolveSmartArtThreeViewSpec(
	element: PptxElement,
	smartArt3D: boolean | null | undefined,
): ThreeViewSpec | null {
	if (!smartArt3D || element.type !== 'smartArt') {
		return null;
	}
	return smartArtThreeViewSpec(element);
}
