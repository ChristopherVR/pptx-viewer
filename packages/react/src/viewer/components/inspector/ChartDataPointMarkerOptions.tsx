import type { PptxChartMarkerSymbol, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	HEADING,
	MARKER_SUPPORTED_TYPES,
	MARKER_SYMBOL_OPTIONS,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartDataPointMarkerOptionsProps {
	chartType: PptxChartType;
	categories: string[];
	series: PptxChartSeries[];
	canEdit: boolean;
	/** Set (patch) or clear (null) the per-point marker override. */
	onSetPointMarker: (
		seriesIndex: number,
		pointIndex: number,
		marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
	) => void;
}

// Concrete symbol options only (exclude the '' auto sentinel).
const SYMBOL_OPTIONS = MARKER_SYMBOL_OPTIONS.filter((o) => o.value !== '');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartDataPointMarkerOptions({
	chartType,
	categories,
	series,
	canEdit,
	onSetPointMarker,
}: ChartDataPointMarkerOptionsProps) {
	const { t } = useTranslation();
	const [seriesIndex, setSeriesIndex] = useState(0);

	if (!MARKER_SUPPORTED_TYPES.has(chartType) || series.length === 0 || categories.length === 0) {
		return null;
	}

	const activeSeries = series[Math.min(seriesIndex, series.length - 1)];
	const pointFor = (idx: number) => activeSeries.dataPoints?.find((p) => p.idx === idx);

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.pointMarkers')}</div>

			{series.length > 1 && (
				<label className='flex items-center gap-2 text-[11px]'>
					<span className='w-12 text-muted-foreground shrink-0'>{t('pptx.chart.series')}</span>
					<select
						disabled={!canEdit}
						className='flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full'
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

			<div className='space-y-2'>
				{categories.map((cat, idx) => {
					const point = pointFor(idx);
					const hasOverride = point?.marker !== undefined;
					return (
						<div key={`${cat}-${idx}`} className='space-y-1'>
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='flex-1 truncate' title={cat}>
									{cat}
								</span>
								<label className='flex items-center gap-1 shrink-0'>
									<input
										type='checkbox'
										disabled={!canEdit}
										checked={hasOverride}
										onChange={(e) => {
											onSetPointMarker(
												seriesIndex,
												idx,
												e.target.checked ? { symbol: 'circle' } : null,
											);
										}}
									/>
									<span className='text-muted-foreground'>{t('pptx.chart.markerOverride')}</span>
								</label>
							</div>

							{hasOverride && point?.marker && (
								<div className='flex items-center gap-2 ml-2 flex-wrap'>
									<select
										disabled={!canEdit}
										className='bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]'
										value={point.marker.symbol}
										onChange={(e) =>
											onSetPointMarker(seriesIndex, idx, {
												symbol: e.target.value as PptxChartMarkerSymbol,
											})
										}
									>
										{SYMBOL_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{t(opt.labelKey)}
											</option>
										))}
									</select>
									<input
										type='number'
										min={1}
										max={20}
										disabled={!canEdit}
										title={t('pptx.chart.markerSize')}
										className='w-14 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]'
										value={point.marker.size ?? ''}
										placeholder={t('pptx.chart.auto')}
										onChange={(e) => {
											const num = Number.parseInt(e.target.value, 10);
											onSetPointMarker(seriesIndex, idx, {
												size: Number.isFinite(num) ? num : undefined,
											});
										}}
									/>
									<input
										type='color'
										disabled={!canEdit}
										title={t('pptx.chart.markerFill')}
										className='h-6 w-8 cursor-pointer rounded border border-border bg-transparent'
										value={point.marker.spPr?.fillColor ?? '#4472c4'}
										onChange={(e) =>
											onSetPointMarker(seriesIndex, idx, { fillColor: e.target.value })
										}
									/>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
