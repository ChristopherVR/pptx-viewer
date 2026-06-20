import type { PptxChartSeries, PptxChartTrendline, PptxChartType } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	HEADING,
	INPUT,
	TRENDLINE_SUPPORTED_TYPES,
	TRENDLINE_TYPE_OPTIONS,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartTrendlineOptionsProps {
	chartType: PptxChartType;
	series: PptxChartSeries[];
	canEdit: boolean;
	onSetTrendline: (seriesIndex: number, trendline: PptxChartTrendline | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartTrendlineOptions({
	chartType,
	series,
	canEdit,
	onSetTrendline,
}: ChartTrendlineOptionsProps) {
	const { t } = useTranslation();

	if (!TRENDLINE_SUPPORTED_TYPES.has(chartType) || series.length === 0) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.trendlines')}</div>
			<div className='space-y-2'>
				{series.map((s, i) => {
					const trendline = s.trendlines?.[0];
					return (
						<div key={`${s.name}-${i}`} className='space-y-1'>
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='flex-1 truncate' title={s.name}>
									{s.name}
								</span>
								<select
									disabled={!canEdit}
									className={INPUT}
									value={trendline?.trendlineType ?? ''}
									onChange={(e) => {
										const value = e.target.value;
										if (!value) {
											onSetTrendline(i, null);
											return;
										}
										onSetTrendline(i, {
											...trendline,
											trendlineType: value as PptxChartTrendline['trendlineType'],
										});
									}}
								>
									{TRENDLINE_TYPE_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{t(opt.labelKey)}
										</option>
									))}
								</select>
							</div>

							{trendline && (
								<div className='flex items-center gap-3 ml-2'>
									<label className='flex items-center gap-1 text-[11px] cursor-pointer'>
										<input
											type='checkbox'
											disabled={!canEdit}
											checked={trendline.displayEq ?? false}
											onChange={(e) =>
												onSetTrendline(i, { ...trendline, displayEq: e.target.checked })
											}
											className='accent-primary'
										/>
										<span>{t('pptx.chart.trendlineEquation')}</span>
									</label>
									<label className='flex items-center gap-1 text-[11px] cursor-pointer'>
										<input
											type='checkbox'
											disabled={!canEdit}
											checked={trendline.displayRSq ?? false}
											onChange={(e) =>
												onSetTrendline(i, { ...trendline, displayRSq: e.target.checked })
											}
											className='accent-primary'
										/>
										<span>{t('pptx.chart.trendlineRSquared')}</span>
									</label>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
