/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The SmartArt SVG-fallback layout engine was consolidated into
 * `pptx-viewer-shared` (`render/smartart-layout*.ts`), shared by every binding.
 * This module was the most complete of the three bindings (10 families) and
 * became the canonical engine. This shim preserves the historical Vue import
 * surface (geometry types + per-family computers + `computeSmartArtLayout`) so
 * `SmartArtRenderer.vue` and the colocated test keep importing the same names
 * unchanged.
 */
export type {
	LayoutRect,
	RenderedRectNode,
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedNode,
	RenderedConnector,
	SmartArtLayoutResult,
	LayoutFamily,
	BoundingBox,
} from 'pptx-viewer-shared';
export {
	colour,
	nodeOpacity,
	styleShadow,
	styleStroke,
	truncate,
	fitFontSize,
	buildTree,
	treeWidth,
	treeDepth,
	flattenNodes,
	resolveLayoutFamily,
	computeListLayout,
	computeProcessLayout,
	computeCycleLayout,
	computeHierarchyLayout,
	computeMatrixLayout,
	computeRadialLayout,
	computePyramidLayout,
	computeVennLayout,
	computeFunnelLayout,
	computeTargetLayout,
	computeSmartArtLayout,
} from 'pptx-viewer-shared';
