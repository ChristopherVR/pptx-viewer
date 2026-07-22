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
	PptxSmartArtLayoutDefinition,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtLayout,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { interpolateColor } from './animation-color';
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
import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

export * from './smartart-layout-types';
export * from './smartart-layout-helpers';
export * from './smartart-layout-families';
export * from './smartart-layout-families-extra';
export * from './smartart-layout-interpreter';
export * from './smartart-layout-interpreter-model';

/** Colour-list interpolation controls resolved from a SmartArt colour scheme. */
export interface SmartArtPaletteInterpolation {
	/** `span` interpolates a gradient across nodes; `cycle`/`repeat` wrap. */
	method?: 'span' | 'cycle' | 'repeat';
	/** Hue rotation direction for `span` interpolation in HSL space. */
	hueDirection?: 'cw' | 'ccw';
}

/**
 * Expand a colour palette across `count` nodes.
 *
 * For `span`, distributes the nodes evenly along the palette and interpolates
 * intermediate colours in HSL space (honouring `hueDirection`), so e.g. a
 * two-colour "colorful range" scheme fades smoothly across many nodes. For
 * `cycle`/`repeat`/unset, wraps the palette by index (the historic behaviour).
 */
export function interpolateSmartArtPalette(
	palette: string[],
	count: number,
	method?: 'span' | 'cycle' | 'repeat',
	hueDirection?: 'cw' | 'ccw',
): string[] {
	if (count <= 0 || palette.length === 0) {
		return [];
	}
	if (method !== 'span' || palette.length < 2 || count <= palette.length) {
		return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
	}
	const segments = palette.length - 1;
	return Array.from({ length: count }, (_, i) => {
		const pos = (i / (count - 1)) * segments;
		const lower = Math.min(Math.floor(pos), segments - 1);
		const frac = pos - lower;
		return interpolateColor(palette[lower], palette[lower + 1], frac, 'hsl', hueDirection);
	});
}

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
 * @param interpolation       - Optional colour-list span/cycle interpolation
 *                              (from the diagram's colour scheme). When `span`,
 *                              the palette is expanded into a per-node gradient
 *                              before layout; otherwise the palette is used
 *                              as-is and cycled by the family computers.
 * @param layoutDefinition    - Optional parsed `dgm:layoutDef`. When present and
 *                              its primary `dgm:alg` family is recognised, the
 *                              real DiagramML interpreter runs and its geometry
 *                              is returned; otherwise the legacy family
 *                              approximation below is used (no regression).
 * @param presLayoutVars      - Optional presentation layout variables (flow
 *                              direction / hierarchy branch / org-chart) that
 *                              refine the interpreter's arrangement.
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
	interpolation?: SmartArtPaletteInterpolation,
	layoutDefinition?: PptxSmartArtLayoutDefinition,
	presLayoutVars?: PptxSmartArtPresLayoutVars,
): SmartArtLayoutResult {
	const flat = flattenNodes(nodes);
	const family = resolveLayoutFamily(nodes, resolvedLayoutType, layout);
	const pal =
		interpolation?.method === 'span'
			? interpolateSmartArtPalette(palette, flat.length, 'span', interpolation.hueDirection)
			: palette;

	const interpreted = interpretSmartArtLayout({
		layoutDefinition,
		nodes,
		flat,
		box,
		palette: pal,
		style,
		elementId,
		presLayoutVars,
	});
	if (interpreted) {
		return interpreted;
	}

	switch (family) {
		case 'list':
			return computeListLayout(flat, box, pal, style, elementId);
		case 'process':
			return computeProcessLayout(flat, box, pal, style, elementId);
		case 'cycle':
			return computeCycleLayout(flat, box, pal, style, elementId);
		case 'hierarchy':
			return computeHierarchyLayout(nodes, box, pal, style, elementId);
		case 'matrix':
			return computeMatrixLayout(flat, box, pal, style, elementId);
		case 'radial':
			return computeRadialLayout(flat, box, pal, style, elementId);
		case 'pyramid':
			return computePyramidLayout(flat, box, pal, style, elementId);
		case 'venn':
			return computeVennLayout(flat, box, pal, style, elementId);
		case 'funnel':
			return computeFunnelLayout(flat, box, pal, style, elementId);
		case 'target':
			return computeTargetLayout(flat, box, pal, style, elementId);
	}
}
