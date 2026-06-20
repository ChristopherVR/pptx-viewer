import type {
	PptxChartMarker,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartType,
} from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	HEADING,
	INPUT,
	MARKER_SUPPORTED_TYPES,
	MARKER_SYMBOL_OPTIONS,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartMarkerOptionsProps {
	chartType: PptxChartType;
	series: PptxChartSeries[];
	canEdit: boolean;
	/** Patch a series' marker: `null` removes it, a partial merges into the existing one. */
	onSetMarker: (
		seriesIndex: number,
		marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
	) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartMarkerOptions({
	chartType,
	series,
	canEdit,
	onSetMarker,
}: ChartMarkerOptionsProps) {
	const { t } = useTranslation();

	if (!MARKER_SUPPORTED_TYPES.has(chartType) || series.length === 0) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.markers')}</div>
			<div className='space-y-2'>
				{series.map((s, i) => {
					const marker: PptxChartMarker | undefined = s.marker;
					return (
						<div key={`${s.name}-${i}`} className='space-y-1'>
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='flex-1 truncate' title={s.name}>
									{s.name}
								</span>
								<select
									disabled={!canEdit}
									className={INPUT}
									value={marker?.symbol ?? ''}
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											onSetMarker(i, null);
											return;
										}
										onSetMarker(i, { symbol: value as PptxChartMarkerSymbol });
									}}
								>
									{MARKER_SYMBOL_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{t(opt.labelKey)}
										</option>
									))}
								</select>
							</div>

							{marker && marker.symbol !== 'none' && (
								<div className='flex items-center gap-3 ml-2'>
									<label className='flex items-center gap-1 text-[11px]'>
										<span className='text-muted-foreground'>{t('pptx.chart.markerSize')}</span>
										<input
											type='number'
											min={2}
											max={72}
											disabled={!canEdit}
											className='w-14 bg-muted border border-border rounded px-1.5 py-0.5'
											value={marker.size ?? ''}
											placeholder={t('pptx.chart.auto')}
											onChange={(e) => {
												const raw = e.target.value;
												const num = Number.parseInt(raw, 10);
												onSetMarker(i, { size: Number.isFinite(num) ? num : undefined });
											}}
										/>
									</label>
									<label className='flex items-center gap-1 text-[11px]'>
										<span className='text-muted-foreground'>{t('pptx.chart.markerFill')}</span>
										<input
											type='color'
											disabled={!canEdit}
											className='h-6 w-8 cursor-pointer rounded border border-border bg-transparent'
											value={marker.spPr?.fillColor ?? '#4472c4'}
											onChange={(e) => onSetMarker(i, { fillColor: e.target.value })}
										/>
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
