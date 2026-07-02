/**
 * table-cell-advanced-fill-constants.ts: thin re-export shim.
 *
 * The advanced (gradient / pattern) cell-fill option lists + shared class tokens
 * now live in `pptx-viewer-shared` (`render/table-advanced-fill.ts`) so React,
 * Vue and Angular share one copy. This module preserves the original public
 * symbol surface so colocated consumers (and their tests) keep importing the
 * same names.
 */
export {
	SEL,
	NUM,
	LBL,
	SECTION_HEADING,
	FILL_MODE_OPTIONS,
	GRADIENT_TYPE_OPTIONS,
	PATTERN_OPTIONS,
} from 'pptx-viewer-shared';
