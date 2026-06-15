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
 *
 * Roadmap (see packages/angular/PORTING.md and packages/vue/PORTING.md):
 *   color resolution, geometry/clip-paths, connector routing, animation
 *   timeline engine, table-merge math, morph matching, export data helpers.
 */
export * from './theme';
export * from './loader';
export * from './types';
export * from './constants';
export * from './render';
