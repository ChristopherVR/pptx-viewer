/** Editable metadata shared by DiagramML quick-style and color definitions. */

export interface PptxSmartArtDefinitionText {
	value: string;
	language?: string;
}

export interface PptxSmartArtDefinitionCategory {
	type: string;
	priority: number;
}

export type PptxSmartArtColorApplicationMethod = 'span' | 'cycle' | 'repeat';
export type PptxSmartArtHueDirection = 'cw' | 'ccw';

/** CT_Colors application metadata. Color-choice children remain preserved XML. */
export interface PptxSmartArtColorListMetadata {
	method?: PptxSmartArtColorApplicationMethod;
	hueDirection?: PptxSmartArtHueDirection;
}

/** CT_StyleLabel metadata from a quick-style definition. */
export interface PptxSmartArtQuickStyleLabel {
	name: string;
}

/** CT_CTStyleLabel metadata from a color-transform definition. */
export interface PptxSmartArtColorStyleLabel {
	name: string;
	fill?: PptxSmartArtColorListMetadata;
	line?: PptxSmartArtColorListMetadata;
	effect?: PptxSmartArtColorListMetadata;
	textLine?: PptxSmartArtColorListMetadata;
	textFill?: PptxSmartArtColorListMetadata;
	textEffect?: PptxSmartArtColorListMetadata;
}

export interface PptxSmartArtDefinitionMetadata {
	uniqueId?: string;
	minimumVersion?: string;
	titles?: PptxSmartArtDefinitionText[];
	descriptions?: PptxSmartArtDefinitionText[];
	categories?: PptxSmartArtDefinitionCategory[];
}

/** Typed CT_ColorTransform metadata and the resolved legacy color palette. */
export interface PptxSmartArtColorTransform extends PptxSmartArtDefinitionMetadata {
	/** Legacy resolved display name. */
	name?: string;
	/** Ordered resolved fill colors for rendering. */
	fillColors: string[];
	/** Ordered resolved line colors for rendering. */
	lineColors: string[];
	/** Ordered CT_CTStyleLabel metadata. */
	labels?: PptxSmartArtColorStyleLabel[];
}

/** Typed CT_StyleDefinition metadata and legacy rendering hint. */
export interface PptxSmartArtQuickStyle extends PptxSmartArtDefinitionMetadata {
	/** Legacy resolved display name. */
	name?: string;
	/** Legacy effect-intensity rendering hint. */
	effectIntensity?: string;
	/** Ordered CT_StyleLabel metadata. Complex style payload remains preserved XML. */
	labels?: PptxSmartArtQuickStyleLabel[];
}
