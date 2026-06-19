/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The Office chart style-id → palette mapping (`getChartStylePalette`,
 * `DEFAULT_CHART_PALETTE`) and the tint/shade colour transforms were
 * consolidated into `pptx-viewer-shared` (`render/chart-helpers.ts` and
 * `render/chart-palette.ts`). This shim preserves the historical React import
 * surface so consumers and colocated tests keep importing the same names.
 */
export { tint, shade } from 'pptx-viewer-shared';
export { getChartStylePalette, DEFAULT_CHART_PALETTE } from 'pptx-viewer-shared';
