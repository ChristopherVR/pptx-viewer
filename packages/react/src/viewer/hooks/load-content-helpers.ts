/**
 * Load-pipeline helpers: moved to the framework-agnostic `pptx-viewer-shared`
 * package so the React, Vue, and Angular bindings share one copy.
 *
 * Re-exported here to keep existing import paths stable.
 */
export type { GuideEntry, ImagePathElement } from 'pptx-viewer-shared';
export { collectMediaElements, collectImagePaths, buildInitialGuides } from 'pptx-viewer-shared';
