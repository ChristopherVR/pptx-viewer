/**
 * Leaf DiagramML layout-definition types (localized text, categories,
 * algorithm parameters, iterator/`dgm:forEach`/`dgm:when`/`dgm:choose`
 * attributes, and `dgm:shape` metadata) split out of
 * `smart-art-layout-definition.ts` to keep that file's own
 * `PptxSmartArtLayoutNode`/`PptxSmartArtLayoutDefinition` declarations
 * within the per-file line budget. Re-exported from `smart-art-layout-
 * definition.ts` and from the `smart-art`/types barrel, so every existing
 * import path keeps working unchanged - see `smart-art-node.ts` for the
 * same split pattern applied to node-related types.
 */

import type { XmlObject } from './common';

export interface PptxSmartArtLocalizedText {
	value: string;
	language?: string;
}

export interface PptxSmartArtLayoutCategory {
	type: string;
	priority: number;
}

export interface PptxSmartArtAlgorithmParameter {
	type: string;
	value?: string;
}

/** Typed DiagramML CT_Algorithm data attached to a layout node. */
export interface PptxSmartArtLayoutAlgorithm {
	type: string;
	revision?: number;
	parameters?: PptxSmartArtAlgorithmParameter[];
}

export interface PptxSmartArtIteratorAttributes {
	name?: string;
	reference?: string;
	axis?: string[];
	pointTypes?: string[];
	hideLastTransition?: boolean[];
	start?: number[];
	count?: number[];
	step?: number[];
}

export interface PptxSmartArtForEach extends PptxSmartArtIteratorAttributes {
	rawXml?: XmlObject;
}

export interface PptxSmartArtWhen extends PptxSmartArtIteratorAttributes {
	function: string;
	argument?: string;
	operator: string;
	value: string;
	rawXml?: XmlObject;
}

export interface PptxSmartArtChoose {
	name?: string;
	when: PptxSmartArtWhen[];
	otherwise?: { name?: string; rawXml?: XmlObject } | null;
	rawXml?: XmlObject;
}

/** A single `dgm:adj/@val` adjustment, keyed by its `@idx` (1-based, like `a:gd`). */
export interface PptxSmartArtShapeAdjustment {
	index: number;
	value: number;
}

/**
 * Typed DiagramML CT_Shape data (`dgm:shape`) attached to a layout node: the
 * per-node preset geometry override real (and third-party/custom) layout
 * definitions use so a layoutNode can be e.g. an ellipse or a chevron instead
 * of the arranger family's hardcoded default shape.
 */
export interface PptxSmartArtLayoutNodeShape {
	/** `dgm:shape/@type`: a preset geometry name (`roundRect`, `ellipse`, `chevron`, `conn`, ...). */
	presetGeometry?: string;
	/** `dgm:adjLst/dgm:adj` entries (adjustment index -> value, as authored). */
	adjustments?: PptxSmartArtShapeAdjustment[];
	/** `dgm:shape/@hideGeom`: the shape is present only to size text, never painted. */
	hideGeometry?: boolean;
	/**
	 * `dgm:shape/@lkTxEntry` (CT_Shape, boolean, default false): this node is a
	 * decorative shape that should mirror its paired content node's text
	 * rather than always rendering blank. See `smartart-layout-interpreter-
	 * pyramid.ts`'s `arrangePyramid`, the interpreter's one existing
	 * synthesized-decorative-shape call site.
	 */
	lkTxEntry?: boolean;
}
