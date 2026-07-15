/** Typed, editable metadata from a DiagramML layout-definition part. */

export interface PptxSmartArtLocalizedText {
	value: string;
	language?: string;
}

export interface PptxSmartArtLayoutCategory {
	type: string;
	priority: number;
}

/** Identity and ordering metadata from DiagramML CT_LayoutNode. */
export interface PptxSmartArtLayoutNode {
	name?: string;
	styleLabel?: string;
	childOrder?: 'b' | 't';
	moveWith?: string;
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
