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

/** The last element (and its spec) seen per element id, per kind. */
const lastByIdChart = new Map<string, { element: PptxElement; view: ThreeViewSpec | null }>();
const lastByIdSmartArt = new Map<string, { element: PptxElement; view: ThreeViewSpec | null }>();

/** Fields a spec never reads: moving an element must not rebuild its scene. */
const POSITION_KEYS = new Set(['x', 'y']);

/**
 * Whether two versions of an element differ only in position. An editor
 * move patches `x`/`y` into a fresh element object on every pointer move;
 * without this the spec (keyed by object) changed each time and the view
 * rebuilt its whole scene mid-drag.
 */
export function differsOnlyInPosition(a: PptxElement, b: PptxElement): boolean {
	const ra = a as unknown as Record<string, unknown>;
	const rb = b as unknown as Record<string, unknown>;
	const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
	for (const key of keys) {
		if (!POSITION_KEYS.has(key) && ra[key] !== rb[key]) {
			return false;
		}
	}
	return true;
}

function memoised(
	element: PptxElement,
	byObject: WeakMap<PptxElement, ThreeViewSpec | null>,
	byId: Map<string, { element: PptxElement; view: ThreeViewSpec | null }>,
	build: () => ThreeViewSpec | null,
): ThreeViewSpec | null {
	if (byObject.has(element)) {
		return byObject.get(element) ?? null;
	}
	const last = byId.get(element.id);
	const view = last && differsOnlyInPosition(last.element, element) ? last.view : build();
	byObject.set(element, view);
	byId.set(element.id, { element, view });
	return view;
}

/** The (memoised) chart spec for an element, ignoring flags; `null` when it is not a 3D chart. */
export function chartThreeViewSpec(element: PptxElement): ThreeViewSpec | null {
	return memoised(element, chartSpecs, lastByIdChart, () => {
		const spec = buildChart3DSpecForElement(element);
		return spec ? { kind: 'chart', spec } : null;
	});
}

/** The (memoised) SmartArt spec for an element; `null` when it has nothing to draw. */
export function smartArtThreeViewSpec(element: PptxElement): ThreeViewSpec | null {
	return memoised(element, smartArtSpecs, lastByIdSmartArt, () => {
		const spec = buildSmartArt3DSpecForElement(element);
		return spec ? { kind: 'smartart', spec } : null;
	});
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
