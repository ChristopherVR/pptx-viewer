/**
 * Thin re-export shim. The framework-agnostic advanced-text panel helpers
 * (readers + patch-builders + option lists) now live in `pptx-viewer-shared`.
 */
export {
	TEXT_DIRECTION_OPTIONS,
	ALIGN_OPTIONS,
	VALIGN_OPTIONS,
	textAdvancedStateOf,
	textAdvancedStateFromStyle,
	textAdvancedPatch,
	characterSpacingPatch,
	lineSpacingPatch,
	alignPatch,
	vAlignPatch,
	textDirectionPatch,
} from '../internal/shared';
export type { TextAdvancedState, TextAdvancedChanges } from '../internal/shared';
