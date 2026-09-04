/**
 * Load-pipeline helpers: moved to the framework-agnostic `pptx-viewer-shared`
 * package so the React, Vue, and Angular bindings share one copy.
 *
 * Re-exported here to keep existing import paths stable.
 */
export type {
	GuideEntry,
	ImagePathElement,
	TableCellImageRef,
	TableStyleImageRef,
	MediaArrayBufferSource,
	MediaSourceResolution,
} from 'pptx-viewer-shared';
export {
	collectMediaElements,
	collectImagePaths,
	collectTableCellImagePaths,
	applyTableCellImagePatches,
	collectTableStyleImagePaths,
	applyTableStyleImagePatches,
	buildInitialGuides,
	resolveMediaElementSource,
} from 'pptx-viewer-shared';
