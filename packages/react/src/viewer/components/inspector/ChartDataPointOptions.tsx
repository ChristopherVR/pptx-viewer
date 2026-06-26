import type { PptxChartDataPoint, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CARD, EXPLOSION_SUPPORTED_TYPES, HEADING, INPUT } from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartDataPointOptionsProps {
	chartType: PptxChartType;
	categories: string[];
	series: PptxChartSeries[];
	canEdit: boolean;
	onSetPointFill: (seriesIndex: number, pointIndex: number, color: string | null) => void;
	onSetPointExplosion: (seriesIndex: number, pointIndex: number, explosion: number | null) => void;
	/** Set a custom label text for this point, or pass null to clear the override. */
	onSetPointLabel: (seriesIndex: number, pointIndex: number, text: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartDataPointOptions({
	chartType,
	categories,
	series,
	canEdit,
	onSetPointFill,
	onSetPointExplosion,
	onSetPointLabel,
}: ChartDataPointOptionsProps) {
	const { t } = useTranslation();
	const [seriesIndex, setSeriesIndex] = useState(0);

	if (series.length === 0 || categories.length === 0) {
		return null;
	}

	const activeSeries = series[Math.min(seriesIndex, series.length - 1)];
	const showExplosion = EXPLOSION_SUPPORTED_TYPES.has(chartType);
	const pointFor = (idx: number): PptxChartDataPoint | undefined =>
		activeSeries.dataPoints?.find((p) => p.idx === idx);

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.dataPoints')}</div>

			{/* Series picker (per-point overrides target one series at a time). */}
			{series.length > 1 && (
				<label className='flex items-center gap-2 text-[11px]'>
					<span className='w-12 text-muted-foreground shrink-0'>{t('pptx.chart.series')}</span>
					<select
						disabled={!canEdit}
						className={INPUT}
						value={Math.min(seriesIndex, series.length - 1)}
						onChange={(e) => setSeriesIndex(Number.parseInt(e.target.value, 10))}
					>
						{series.map((s, i) => (
							<option key={`${s.name}-${i}`} value={i}>
								{s.name}
							</option>
						))}
					</select>
				</label>
			)}

			<div className='space-y-1.5'>
				{categories.map((cat, idx) => {
					const point = pointFor(idx);
					return (
						<div key={`${cat}-${idx}`} className='flex items-center gap-2 text-[11px]'>
							<span className='flex-1 truncate' title={cat}>
								{cat}
							</span>

							{/* Per-point label text override */}
							<input
								type='text'
								disabled={!canEdit}
								title={t('pptx.chart.pointLabelOverride')}
								className='w-20 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]'
								value={activeSeries.dataLabels?.find((l) => l.idx === idx)?.text ?? ''}
								placeholder={t('pptx.chart.auto')}
								onChange={(e) => {
									const raw = e.target.value;
									onSetPointLabel(seriesIndex, idx, raw === '' ? null : raw);
								}}
							/>

							{/* Per-point fill */}
							<input
								type='color'
								disabled={!canEdit}
								title={t('pptx.chart.pointFill')}
								className='h-6 w-8 cursor-pointer rounded border border-border bg-transparent'
								value={point?.spPr?.fillColor ?? activeSeries.color ?? '#4472c4'}
								onChange={(e) => onSetPointFill(seriesIndex, idx, e.target.value)}
							/>
							{point?.spPr?.fillColor && (
								<button
									type='button'
									disabled={!canEdit}
									title={t('pptx.chart.pointFillClear')}
									className='text-muted-foreground hover:text-foreground'
									onClick={() => onSetPointFill(seriesIndex, idx, null)}
								>
									&times;
								</button>
							)}

							{/* Pie/doughnut slice explosion */}
							{showExplosion && (
								<input
									type='number'
									min={0}
									max={100}
									disabled={!canEdit}
									title={t('pptx.chart.pointExplosion')}
									className='w-14 bg-muted border border-border rounded px-1.5 py-0.5'
									value={point?.explosion ?? ''}
									placeholder='0'
									onChange={(e) => {
										const raw = e.target.value;
										if (raw === '') {
											onSetPointExplosion(seriesIndex, idx, null);
											return;
										}
										const num = Number.parseInt(raw, 10);
										if (Number.isFinite(num)) {
											onSetPointExplosion(seriesIndex, idx, num);
										}
									}}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
