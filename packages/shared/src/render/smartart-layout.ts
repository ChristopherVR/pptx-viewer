/**
 * SmartArt layout engine — public entry point + dispatcher.
 *
 * Computes per-node SVG-fallback geometry (`RenderedNode` / `RenderedConnector`)
 * from a SmartArt node tree and a bounding box, for the path taken when a
 * SmartArt element has no pre-computed `drawingShapes`. Pure TypeScript — no
 * framework code, no DOM — consumed identically by the React, Vue, and Angular
 * bindings.
 *
 * Consolidated from the Vue engine
 * (`packages/vue/src/viewer/composables/smartart-layout.ts`), which was the
 * most complete of the three bindings (10 families vs Angular's 4). The richer
 * `RenderedNode` contract (fully-styled rect/circle/polygon view-models) is the
 * one declared by `smartart-layout-types`. Angular's leaner `PositionedNode`
 * box engine (`smart-art-layouts.ts`) is a deliberately different abstraction
 * and remains binding-local.
 *
 * Re-exports the helpers, family computers, and geometry types so a single
 * `import … from 'pptx-viewer-shared'` (or a thin binding shim) yields the full
 * surface the renderers and colocated tests expect.
 */

import type {
	PptxSmartArtNode,
	SmartArtLayout,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';

import {
	computeCycleLayout,
	computeHierarchyLayout,
	computeListLayout,
	computeMatrixLayout,
	computeProcessLayout,
} from './smartart-layout-families';
import {
	computeFunnelLayout,
	computePyramidLayout,
	computeRadialLayout,
	computeTargetLayout,
	computeVennLayout,
} from './smartart-layout-families-extra';
import { flattenNodes, resolveLayoutFamily } from './smartart-layout-helpers';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

export * from './smartart-layout-types';
export * from './smartart-layout-helpers';
export * from './smartart-layout-families';
export * from './smartart-layout-families-extra';

/**
 * Compute the SVG layout for a SmartArt element when drawing shapes are absent.
 *
 * @param nodes               - Flat/nested node array from `PptxSmartArtData`.
 * @param box                 - Pixel bounding box of the element.
 * @param palette             - Resolved colour palette.
 * @param style               - Resolved SmartArt style intensity.
 * @param elementId           - Element ID (used for stable SVG key generation).
 * @param resolvedLayoutType  - Layout type string from the core parser.
 * @param layout              - Named layout preset.
 * @returns Complete layout geometry for the resolved family.
 */
export function computeSmartArtLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	resolvedLayoutType?: SmartArtLayoutType,
	layout?: SmartArtLayout,
): SmartArtLayoutResult {
	const flat = flattenNodes(nodes);
	const family = resolveLayoutFamily(nodes, resolvedLayoutType, layout);

	switch (family) {
		case 'list':
			return computeListLayout(flat, box, palette, style, elementId);
		case 'process':
			return computeProcessLayout(flat, box, palette, style, elementId);
		case 'cycle':
			return computeCycleLayout(flat, box, palette, style, elementId);
		case 'hierarchy':
			return computeHierarchyLayout(nodes, box, palette, style, elementId);
		case 'matrix':
			return computeMatrixLayout(flat, box, palette, style, elementId);
		case 'radial':
			return computeRadialLayout(flat, box, palette, style, elementId);
		case 'pyramid':
			return computePyramidLayout(flat, box, palette, style, elementId);
		case 'venn':
			return computeVennLayout(flat, box, palette, style, elementId);
		case 'funnel':
			return computeFunnelLayout(flat, box, palette, style, elementId);
		case 'target':
			return computeTargetLayout(flat, box, palette, style, elementId);
	}
}
