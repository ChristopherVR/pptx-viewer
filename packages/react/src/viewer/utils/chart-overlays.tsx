/**
 * Chart overlay rendering (trendlines, error bars, drop lines, hi-low lines).
 *
 * Barrel re-export — implementation split into:
 *   - chart-overlay-utils.ts   (shared types + utility functions)
 *   - chart-trendlines.tsx     (trendline computation + rendering)
 *   - chart-overlay-lines.tsx  (error bars, drop lines, hi-low lines)
 */
export type { ChartPlotLayout, ChartValueRange } from "./chart-overlay-utils";
export { renderTrendlines } from "./chart-trendlines";
export {
  renderErrorBars,
  renderDropLines,
  renderHiLowLines,
} from "./chart-overlay-lines";
