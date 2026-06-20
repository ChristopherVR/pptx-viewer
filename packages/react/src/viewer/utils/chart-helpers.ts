/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Value-range / Y-mapping / axis formatting / palette helpers were consolidated
 * into `pptx-viewer-shared` (`render/chart-helpers.ts` for the linear basics and
 * `render/chart-axis.ts` for log-scale + display-unit helpers). This shim
 * preserves the historical React import surface, including the `PALETTE` alias
 * (= `DEFAULT_CHART_PALETTE`), so the chart `.tsx` renderers and colocated
 * tests keep importing the same names unchanged.
 */
import { DEFAULT_CHART_PALETTE } from 'pptx-viewer-shared';

export type { ValueRange } from 'pptx-viewer-shared';
export {
	computeValueRange,
	valueToY,
	formatAxisValue,
	seriesColor,
	paletteColor,
	getChartStylePalette,
	DEFAULT_CHART_PALETTE,
	// log-scale + display-unit helpers (shared/render/chart-axis.ts)
	computeLogValueRange,
	valueToYLog,
	generateLogTicks,
	findLogAxis,
	computeValueRangeForChart,
	getDisplayUnitDivisor,
	getDisplayUnitLabel,
	formatAxisValueWithUnits,
} from 'pptx-viewer-shared';

/** Default fallback palette (alias of `DEFAULT_CHART_PALETTE`). */
export const PALETTE = DEFAULT_CHART_PALETTE;
