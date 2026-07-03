/**
 * pptx-viewer-shared — framework-agnostic viewer logic shared by the
 * React (`pptx-viewer`), Vue (`pptx-vue-viewer`), and Angular
 * (`pptx-angular-viewer`) bindings.
 *
 * Everything exported here is pure TypeScript (no framework imports), so each
 * UI binding consumes one copy instead of duplicating it.
 *
 * Current surface:
 *   - theme:     ViewerTheme types, default palette, CSS-variable helpers.
 *   - loader:    load-pipeline helpers (media/image collection, guides).
 *   - types:     CanvasSize, CollaborationConfig, CollaborationRole.
 *   - constants: scalar viewer defaults (canvas size, fallback colours).
 *   - render:    the bulk of the shared logic (colour/geometry/connector/
 *                animation/table/chart/text/effects/collaboration/i18n).
 *   - export:    export data helpers.
 */
export * from './theme';
export * from './loader';
export * from './types';
export * from './constants';
export * from './render';
export * from './export';
