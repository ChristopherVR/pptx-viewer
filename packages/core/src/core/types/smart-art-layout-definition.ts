/** Typed, editable metadata from a DiagramML layout-definition part. */

import type { XmlObject } from './common';
import type { PptxSmartArtConstraint, PptxSmartArtNumericRule } from './smart-art-constraint-rules';

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
}

/** Identity and ordering metadata from DiagramML CT_LayoutNode. */
export interface PptxSmartArtLayoutNode {
	name?: string;
	styleLabel?: string;
	childOrder?: 'b' | 't';
	moveWith?: string;
	algorithm?: PptxSmartArtLayoutAlgorithm;
	forEach?: PptxSmartArtForEach[];
	choose?: PptxSmartArtChoose[];
	constraints?: PptxSmartArtConstraint[];
	rules?: PptxSmartArtNumericRule[];
	/** `dgm:shape`: this node's own preset geometry override, when present. */
	shape?: PptxSmartArtLayoutNodeShape;
	children?: PptxSmartArtLayoutNode[];
}

/** Metadata and root node from DiagramML CT_DiagramDefinition. */
export interface PptxSmartArtLayoutDefinition {
	uniqueId?: string;
	minimumVersion?: string;
	defaultStyle?: string;
	titles?: PptxSmartArtLocalizedText[];
	descriptions?: PptxSmartArtLocalizedText[];
	categories?: PptxSmartArtLayoutCategory[];
	rootNode: PptxSmartArtLayoutNode;
	/** Original definition retained for constraint evaluation and foreign rules. */
	rawXml?: XmlObject;
}
