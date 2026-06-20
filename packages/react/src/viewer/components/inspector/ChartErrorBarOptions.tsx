import type { PptxChartErrBars, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	ERROR_BAR_SUPPORTED_TYPES,
	ERROR_BAR_TYPE_OPTIONS,
	ERROR_BAR_VALTYPE_OPTIONS,
	ERROR_BAR_VALUE_TYPES,
	HEADING,
	INPUT,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartErrorBarOptionsProps {
	chartType: PptxChartType;
	series: PptxChartSeries[];
	canEdit: boolean;
	onSetErrorBars: (seriesIndex: number, errBars: PptxChartErrBars | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartErrorBarOptions({
	chartType,
	series,
	canEdit,
	onSetErrorBars,
}: ChartErrorBarOptionsProps) {
	const { t } = useTranslation();

	if (!ERROR_BAR_SUPPORTED_TYPES.has(chartType) || series.length === 0) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.errorBars')}</div>
			<div className='space-y-2'>
				{series.map((s, i) => {
					const bars = s.errBars?.[0];
					const valType = bars?.valType ?? '';
					const showValue = ERROR_BAR_VALUE_TYPES.has(valType);
					return (
						<div key={`${s.name}-${i}`} className='space-y-1'>
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='flex-1 truncate' title={s.name}>
									{s.name}
								</span>
								<select
									disabled={!canEdit}
									className={INPUT}
									value={valType}
									onChange={(e) => {
										const value = e.target.value;
										if (!value) {
											onSetErrorBars(i, null);
											return;
										}
										onSetErrorBars(i, {
											direction: bars?.direction ?? 'y',
											barType: bars?.barType ?? 'both',
											valType: value as PptxChartErrBars['valType'],
											val: bars?.val,
										});
									}}
								>
									{ERROR_BAR_VALTYPE_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{t(opt.labelKey)}
										</option>
									))}
								</select>
							</div>

							{bars && (
								<div className='flex items-center gap-2 ml-2'>
									<select
										disabled={!canEdit}
										className={INPUT}
										value={bars.barType}
										onChange={(e) =>
											onSetErrorBars(i, {
												...bars,
												barType: e.target.value as PptxChartErrBars['barType'],
											})
										}
									>
										{ERROR_BAR_TYPE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{t(opt.labelKey)}
											</option>
										))}
									</select>
									{showValue && (
										<input
											type='number'
											disabled={!canEdit}
											className={INPUT}
											value={bars.val ?? ''}
											placeholder={t('pptx.chart.errorBarAmount')}
											onChange={(e) => {
												const raw = e.target.value;
												const num = raw === '' ? undefined : Number.parseFloat(raw);
												if (raw !== '' && !Number.isFinite(num)) {
													return;
												}
												onSetErrorBars(i, { ...bars, val: num });
											}}
										/>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
