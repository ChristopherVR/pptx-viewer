/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * `buildSurfaceViewModel` / `buildTreemapViewModel` were extracted to
 * `pptx-viewer-shared` (`render/chart-surface-treemap.ts`). This shim keeps the
 * historical Angular import path for the chart engine and its tests.
 */
export * from '../internal/shared-src/render/chart-surface-treemap';
