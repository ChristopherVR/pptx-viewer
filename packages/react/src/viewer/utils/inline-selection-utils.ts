/**
 * Thin re-export shim. The framework-agnostic inline-selection helpers now live
 * in `pptx-viewer-shared`.
 */
export {
	setPendingSelectionRestore,
	getPendingSelectionRestore,
	getInlineEditorSelection,
	applyStyleToSelectedSegments,
	restoreSegmentSelection,
} from 'pptx-viewer-shared';
export type { InlineTextSelection } from 'pptx-viewer-shared';
