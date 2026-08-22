/**
 * SmartArt layout engine: shared public geometry types.
 *
 * Re-exported from `pptx-viewer-core`. This interpreter used to live entirely
 * in this package, but the save/decompose pipeline (which fabricates the
 * cached `dsp:` diagram drawing when PowerPoint's own is absent) lives in
 * `pptx-viewer-core`, and `pptx-viewer-core` cannot import
 * `pptx-viewer-shared` (this package depends on core, not the other way
 * around, and core is published standalone). So the single interpreter and
 * its geometry types moved to core; this file keeps the historic import path
 * (`from './smartart-layout-types'`) working for every consumer here and in
 * the bindings.
 */

export type {
	LayoutRect,
	RenderedNodeTextStyle,
	RenderedNodeIdentity,
	RenderedRectNode,
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedNode,
	RenderedConnector,
	LayoutFamily,
	SmartArtLayoutResult,
	BoundingBox,
	TreeNode,
} from 'pptx-viewer-core';
