/**
 * chart-trendline-defaults.ts: PowerPoint's own default trendline stroke
 * (1.5pt, dotted), applied when a trendline carries no `c:spPr`.
 *
 * Split into its own module (rather than living in `chart-overlays-trendline.ts`,
 * which draws the trendline itself) so `chart-legend-build.ts` can share the
 * exact same default for the trendline's legend swatch without importing the
 * `chart-view-model` barrel that module pulls in, which would be circular
 * (the barrel re-exports `chart-legend-build.ts` itself).
 *
 * @module chart-trendline-defaults
 */
export const DEFAULT_TRENDLINE_WIDTH = 1.5;
export const DEFAULT_TRENDLINE_DASH = 'sysDot';
