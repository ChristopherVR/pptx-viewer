/** Typed, editable metadata from a DiagramML layout-definition part. */

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

/** Identity and ordering metadata from DiagramML CT_LayoutNode. */
export interface PptxSmartArtLayoutNode {
	name?: string;
	styleLabel?: string;
	childOrder?: 'b' | 't';
	moveWith?: string;
	algorithm?: PptxSmartArtLayoutAlgorithm;
	constraints?: PptxSmartArtConstraint[];
	rules?: PptxSmartArtNumericRule[];
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
}
