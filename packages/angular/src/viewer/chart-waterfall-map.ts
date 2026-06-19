/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * `buildWaterfallViewModel` / `buildRegionMapViewModel` and the region-map
 * helpers (`resolveRegionCode`, `sequentialColorScale`, `normalizeValue`) were
 * extracted to `pptx-viewer-shared` (`render/chart-waterfall-map.ts`). This shim
 * keeps the historical Angular import path for the chart engine and its tests.
 */
export * from '../internal/shared-src/render/chart-waterfall-map';
