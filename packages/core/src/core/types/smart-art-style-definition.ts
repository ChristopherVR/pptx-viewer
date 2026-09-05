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

/**
 * A quick-style label's `a:lnRef`/`a:fillRef`/`a:effectRef`/`a:fontRef`
 * (`CT_ShapeStyle`, the same complex type an ordinary shape's `p:style`
 * uses), resolved against the theme's `fmtScheme` at parse time instead of
 * the coarse subtle/moderate/intense enum ({@link PptxSmartArtQuickStyle.effectIntensity}).
 * Only populated when a theme format scheme was available when the quick
 * style was parsed. See G13 in the 2026-09 diagram audit.
 */
export interface PptxSmartArtResolvedStyleRef {
	fillColor?: string;
	fillMode?: 'solid' | 'gradient' | 'pattern' | 'none' | 'theme';
	strokeColor?: string;
	strokeWidth?: number;
	/** `a:effectRef`'s theme-resolved outer shadow colour, when the style has one. */
	shadowColor?: string;
	/** `a:fontRef`'s theme-resolved typeface (`+mn-lt`/`+mj-lt` -> the theme's actual font). */
	fontTypeface?: string;
}

/** CT_StyleLabel metadata from a quick-style definition. */
export interface PptxSmartArtQuickStyleLabel {
	name: string;
	/** Theme-resolved `dgm:style` refs for this label's role, when available. */
	resolvedStyle?: PptxSmartArtResolvedStyleRef;
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
	/** Ordered resolved text-fill colors (primary styleLbl `txFillClrLst`). */
	textFillColors?: string[];
	/** Ordered resolved text-line colors (primary styleLbl `txLinClrLst`). */
	textLineColors?: string[];
	/** Ordered resolved effect colors (primary styleLbl `effectClrLst`). */
	effectColors?: string[];
	/** Ordered resolved text-effect colors (primary styleLbl `txEffectClrLst`). */
	textEffectColors?: string[];
	/** Fill-list span/cycle + hue-direction interpolation of the primary styleLbl. */
	fillInterpolation?: PptxSmartArtColorListMetadata;
	/** Line-list span/cycle + hue-direction interpolation of the primary styleLbl. */
	lineInterpolation?: PptxSmartArtColorListMetadata;
	/** Ordered CT_CTStyleLabel metadata. */
	labels?: PptxSmartArtColorStyleLabel[];
	/**
	 * Every `styleLbl`'s own resolved fill/line colour list, keyed by name
	 * (e.g. `node1`, `asst0`, `bgShp`, `revTx`). Unlike {@link fillColors} /
	 * {@link lineColors} (which collapse to ONE "primary" node-role list),
	 * this keeps every role so a node can be coloured from its OWN role's
	 * palette (see `PptxSmartArtNode.styleRole` and `applySmartArtRoleColors`)
	 * instead of a generic cycled colour.
	 */
	roleColors?: Record<string, { fill: string[]; line: string[] }>;
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
