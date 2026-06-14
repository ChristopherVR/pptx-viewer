/**
 * Theme configuration types.
 *
 * Moved to the framework-agnostic `pptx-viewer-shared` package so the React,
 * Vue, and Angular bindings share one definition. Re-exported here to keep the
 * existing `./theme` import paths stable.
 */
export type { ViewerTheme, ViewerThemeColors } from 'pptx-viewer-shared';
