/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * The chart overlay depth (trendline / error-bar / axis-title / data-table
 * primitives and the regression engine) was extracted to `pptx-viewer-shared`
 * (`render/chart-overlays.ts`). This shim keeps the historical Angular import
 * path for the chart engine and its tests.
 */
export * from '../internal/shared-src/render/chart-overlays';
