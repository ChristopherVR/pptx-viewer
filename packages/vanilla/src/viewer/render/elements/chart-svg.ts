/**
 * Vanilla projector for the framework-agnostic chart view-model engine.
 *
 * The pure-DOM renderer now lives in `pptx-viewer-shared`
 * (`render/chart-view-model-dom.ts`) so the 3D chart scene can draw the same
 * SVG chrome; this module keeps the binding's historical import path.
 */
export { renderChartViewModelSvg } from 'pptx-viewer-shared';
