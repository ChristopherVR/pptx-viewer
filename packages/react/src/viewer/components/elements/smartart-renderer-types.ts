import type { PptxElement, PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

/**
 * Common props shared by all SmartArt layout renderer sub-components.
 *
 * Each layout renderer receives the parent element (for dimensions and ID),
 * the list of SmartArt nodes to render, the resolved colour palette, and the
 * resolved style (controls shadows, strokes, opacity).
 */
export interface LayoutRendererProps {
	/** The parent SmartArt element (used for dimensions and key generation). */
	element: PptxElement;
	/** The SmartArt nodes to render. */
	nodes: PptxSmartArtNode[];
	/** Resolved colour palette (array of CSS colour strings). */
	palette: string[];
	/** Resolved SmartArt style (controls shadow, stroke, opacity behaviour). */
	style: SmartArtStyle;
	/**
	 * Optional per-node accessibility label lookup, keyed by node id (from the
	 * shared `buildSmartArtA11y` view-model). When provided, renderers tag each
	 * node group with `role="img"` + `aria-label` and an SVG `<title>`.
	 */
	nodeLabels?: Map<string, string>;
}
