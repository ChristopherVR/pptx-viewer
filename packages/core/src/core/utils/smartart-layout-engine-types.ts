/**
 * SmartArt Layout Engine - Public types.
 *
 * Contains all type definitions and interfaces used by the layout engine,
 * including positioned shape output, constraint values, parsed layout
 * definitions, algorithm types, and rules.
 *
 * @module smartart-layout-engine-types
 */

// ============================================================================
// Positioned shape output
// ============================================================================

/**
 * A positioned shape produced by the layout engine.
 */
export interface LayoutEngineShape {
	/** Identifier of the SmartArt node this shape represents. */
	nodeId: string;
	/** Horizontal position in pixels. */
	x: number;
	/** Vertical position in pixels. */
	y: number;
	/** Width of the shape in pixels. */
	width: number;
	/** Height of the shape in pixels. */
	height: number;
	/** Primary font size selected by layout constraints/rules. */
	fontSize?: number;
}

// ============================================================================
// Constraint values
// ============================================================================

/**
 * Constraint values parsed from `dgm:constrLst` or provided manually.
 *
 * All spacing/size values are expressed as fractions of the container
 * dimension (0-1) unless otherwise noted.  `primFontSz` is in points.
 */
export interface LayoutConstraints {
	/** Node width as a fraction of container width (0-1). */
	w?: number;
	/** Node height as a fraction of container height (0-1). */
	h?: number;
	/** Primary font size in points. */
	primFontSz?: number;
	/** General spacing between elements as a fraction. */
	sp?: number;
	/** Sibling spacing as a fraction. */
	sibSp?: number;
	/** Secondary sibling spacing as a fraction. */
	secSibSp?: number;
	/** Begin padding as a fraction. */
	begPad?: number;
	/** End padding as a fraction. */
	endPad?: number;
	/** Direction: 'norm' (left-to-right) or 'rev' (right-to-left). */
	dir?: 'norm' | 'rev';
	/** Number of columns for snake/grid layouts. */
	cols?: number;
	/** Aspect ratio for nodes (width / height). */
	aspectRatio?: number;
}

// ============================================================================
// Layout definition
// ============================================================================

/**
 * Parsed layout definition from `dgm:layoutDef` XML.
 */
export interface ParsedLayoutDef {
	/** Algorithm type extracted from the layout definition. */
	algorithmType: LayoutAlgorithmType;
	/** Constraints from `dgm:constrLst`. */
	constraints: LayoutConstraints;
	/** Raw rules from `dgm:ruleLst` (for future use). */
	rules: LayoutRule[];
	/** Layout direction parameter. */
	direction?: 'norm' | 'rev';
	/** Layout name from the definition. */
	name?: string;
}

// ============================================================================
// Algorithm types
// ============================================================================

/**
 * Algorithm types that can appear in `dgm:layoutDef`.
 */
export type LayoutAlgorithmType =
	| 'snake'
	| 'pyra'
	| 'hierChild'
	| 'hierRoot'
	| 'cycle'
	| 'lin'
	| 'sp'
	| 'tx'
	| 'composite'
	| 'conn'
	| 'unknown';

// ============================================================================
// Rules
// ============================================================================

/**
 * A rule from `dgm:ruleLst` (constraint overrides with conditions).
 */
export interface LayoutRule {
	/** Rule type (e.g. "w", "h", "primFontSz"). */
	type: string;
	/** Target scope for the rule. */
	for?: string;
	/** Named target for the rule. */
	forName?: string;
	/** Value for the rule. */
	val?: number;
	/** Multiplication factor for the rule. */
	fact?: number;
	/** Maximum value cap for the rule. */
	max?: number;
	/** Point type filter for the rule. */
	ptType?: string;
}
