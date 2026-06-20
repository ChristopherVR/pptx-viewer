/**
 * Cascade warp path generators for WordArt text rendering.
 *
 * Thin re-export shim: the implementation now lives in `pptx-viewer-shared`
 * (`render/text-warp`), consumed by every binding. Kept here so existing React
 * import paths (`./warp-path-cascade`) keep working unchanged.
 */
export { cascadeUpPath, cascadeDownPath } from 'pptx-viewer-shared';
