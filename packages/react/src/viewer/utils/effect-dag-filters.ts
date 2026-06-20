/**
 * Effect DAG filter rendering: thin re-export shim over
 * `pptx-viewer-shared`'s `visual-effects`.
 *
 * Maps parsed `a:effectDag` properties from `ShapeStyle` to CSS filter strings,
 * opacity values, SVG filter markup, and blend modes. The pure computation now
 * lives in shared (consumed identically by the Vue and Angular bindings); this
 * module preserves the React package's historical public symbol surface so
 * existing consumers and colocated tests keep importing unchanged names.
 *
 * @module effect-dag-filters
 */

export {
	getEffectDagCssFilter,
	getEffectDagFilter,
	getEffectDagOpacity,
	getEffectDagBlendMode,
	getDuotoneSvgFilterMarkup,
	hasEffectDagProperties,
} from 'pptx-viewer-shared';
