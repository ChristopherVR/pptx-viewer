import type { PptxChartData } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';
import { LuEye, LuEyeOff } from 'react-icons/lu';

import { BTN, CARD, HEADING } from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartFilteredSeriesOptionsProps {
	chartData: PptxChartData;
	canEdit: boolean;
	/** Hide a currently-visible series (PowerPoint's Chart Filters). */
	onHideSeries: (seriesIndex: number) => void;
	/** Restore a series PowerPoint's Chart Filters hid. */
	onRestoreSeries: (filteredIndex: number) => void;
	/** Edit one cached "Value From Cells" label for a series. */
	onSetDataLabelsRangeCache: (seriesIndex: number, pointIndex: number, text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * PowerPoint's "Chart Filters" series show/hide, plus a per-series editor
 * for the cached label strings behind "Value From Cells"
 * (`c15:datalabelsRange`/`c15:dlblRangeCache`), when a series carries one.
 * Both are read-mostly extensions core previously only round-tripped; see
 * `pptx-viewer-shared`'s `chart-ext-editor-actions.ts` for the pure
 * transforms this panel wraps.
 */
export function ChartFilteredSeriesOptions({
	chartData,
	canEdit,
	onHideSeries,
	onRestoreSeries,
	onSetDataLabelsRangeCache,
}: ChartFilteredSeriesOptionsProps) {
	const { t } = useTranslation();
	const filteredSeries = chartData.filteredSeries ?? [];
	const seriesWithRange = chartData.series
		.map((series, index) => ({ series, index }))
		.filter(({ series }) => series.dataLabelOptions?.dataLabelsRange);

	if (filteredSeries.length === 0 && seriesWithRange.length === 0 && chartData.series.length <= 1) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.chartFilters')}</div>
			{chartData.series.length > 1 && (
				<div className='space-y-1'>
					{chartData.series.map((series, index) => (
						<div
							key={`visible-${series.name}-${index}`}
							className='flex items-center gap-2 text-[11px]'
						>
							<span className='flex-1 truncate' title={series.name}>
								{series.name}
							</span>
							<button
								type='button'
								className={BTN}
								disabled={!canEdit}
								aria-label={t('pptx.chart.hideSeries', { name: series.name })}
								data-testid={`chart-series-hide-${index}`}
								onClick={() => onHideSeries(index)}
							>
								<LuEyeOff className='size-3' aria-hidden='true' />
							</button>
						</div>
					))}
				</div>
			)}
			{filteredSeries.length > 0 && (
				<div className='space-y-1'>
					{filteredSeries.map((filtered, index) => {
						const name =
							filtered.name ?? chartData.filteredSeriesTitle ?? t('pptx.chart.seriesShort');
						return (
							<div
								key={`filtered-${name}-${index}`}
								className='flex items-center gap-2 text-[11px] opacity-60'
							>
								<span className='flex-1 truncate' title={name}>
									{name}
								</span>
								<button
									type='button'
									className={BTN}
									disabled={!canEdit}
									aria-label={t('pptx.chart.showSeries', { name })}
									data-testid={`chart-series-show-${index}`}
									onClick={() => onRestoreSeries(index)}
								>
									<LuEye className='size-3' aria-hidden='true' />
								</button>
							</div>
						);
					})}
				</div>
			)}
			{seriesWithRange.map(({ series, index: seriesIndex }) => (
				<div key={`range-${series.name}-${seriesIndex}`} className='space-y-1'>
					<div className='text-[11px] text-muted-foreground truncate' title={series.name}>
						{t('pptx.chart.valueFromCells', { name: series.name })}
					</div>
					{series.dataLabelOptions!.dataLabelsRange!.cache.map((text, pointIndex) => (
						<label key={pointIndex} className='flex items-center gap-2 text-[11px]'>
							<span className='w-16 shrink-0 truncate text-muted-foreground'>
								{chartData.categories[pointIndex] ?? pointIndex}
							</span>
							<input
								type='text'
								disabled={!canEdit}
								className='flex-1 bg-muted border border-border rounded px-1.5 py-0.5'
								value={text}
								data-testid={`chart-dlbl-range-${seriesIndex}-${pointIndex}`}
								onChange={(e) => onSetDataLabelsRangeCache(seriesIndex, pointIndex, e.target.value)}
							/>
						</label>
					))}
				</div>
			))}
		</div>
	);
}
