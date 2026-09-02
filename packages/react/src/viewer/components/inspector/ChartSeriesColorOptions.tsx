import type { PptxChartData } from 'pptx-viewer-core';
import { isSeriesUsingSecondaryAxis } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import { CARD, HEADING } from './chart-panel-constants';
import { DebouncedColorInput } from './DebouncedColorInput';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartSeriesColorOptionsProps {
	chartData: PptxChartData;
	canEdit: boolean;
	/** Set (hex) or clear (`null`) the solid fill colour of a series. */
	onSetColor: (seriesIndex: number, color: string | null) => void;
	/**
	 * Move a series onto the primary or secondary (right-positioned) value
	 * axis, via the shared `seriesSecondaryAxisPatch`
	 * (render/chart-secondary-axis.ts).
	 */
	onToggleSecondaryAxis: (seriesIndex: number, useSecondary: boolean) => void;
}

/** Fallback swatch colour shown for series with no explicit colour set. */
const DEFAULT_SWATCH = '#4472c4';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * Per-series colour picker for the chart inspector. Each series row shows a
 * swatch (native colour input) that commits the chosen hex via `onSetColor`,
 * a clear button that resets the series to its automatic theme colour, and a
 * "secondary axis" checkbox that moves the series onto the chart's
 * right-positioned value axis (a combo chart's second Y scale).
 */
export function ChartSeriesColorOptions({
	chartData,
	canEdit,
	onSetColor,
	onToggleSecondaryAxis,
}: ChartSeriesColorOptionsProps) {
	const { t } = useTranslation();
	const series = chartData.series;

	if (series.length === 0) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.seriesColors')}</div>
			<div className='space-y-1'>
				{series.map((s, i) => (
					<div key={`${s.name}-${i}`} className='flex items-center gap-2 text-[11px]'>
						<span className='flex-1 truncate' title={s.name}>
							{s.name}
						</span>
						<label className='flex items-center gap-1 text-muted-foreground shrink-0'>
							<input
								type='checkbox'
								disabled={!canEdit}
								checked={isSeriesUsingSecondaryAxis(chartData, i)}
								onChange={(e) => onToggleSecondaryAxis(i, e.target.checked)}
								className='accent-primary'
							/>
							{t('pptx.chart.secondaryAxis')}
						</label>
						<DebouncedColorInput
							value={s.color ?? DEFAULT_SWATCH}
							disabled={!canEdit}
							ariaLabel={t('pptx.chart.seriesColor', { name: s.name })}
							className='h-6 w-8 cursor-pointer rounded border border-border bg-muted p-0'
							onCommit={(hex) => onSetColor(i, hex)}
						/>
						{canEdit && s.color && (
							<button
								type='button'
								className='text-muted-foreground hover:text-red-400 shrink-0'
								title={t('pptx.chart.clearSeriesColor')}
								onClick={() => onSetColor(i, null)}
							>
								<LuX className='w-3 h-3' />
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
