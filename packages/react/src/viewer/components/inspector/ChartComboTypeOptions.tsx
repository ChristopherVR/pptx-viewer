import type { PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	COMBO_SERIES_TYPE_OPTIONS,
	COMBO_SUPPORTED_TYPES,
	HEADING,
	INPUT,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartComboTypeOptionsProps {
	chartType: PptxChartType;
	series: PptxChartSeries[];
	canEdit: boolean;
	/** Set a per-series chart type; `null` reverts the series to the chart-level type. */
	onSetSeriesType: (seriesIndex: number, seriesType: PptxChartType | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartComboTypeOptions({
	chartType,
	series,
	canEdit,
	onSetSeriesType,
}: ChartComboTypeOptionsProps) {
	const { t } = useTranslation();

	// Per-series types only make sense for cartesian charts and existing combos.
	if (!COMBO_SUPPORTED_TYPES.has(chartType) || series.length < 2) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.comboTypes')}</div>
			<div className='space-y-1.5'>
				{series.map((s, i) => (
					<div key={`${s.name}-${i}`} className='flex items-center gap-2 text-[11px]'>
						<span className='flex-1 truncate' title={s.name}>
							{s.name}
						</span>
						<select
							disabled={!canEdit}
							className={INPUT}
							value={s.seriesChartType ?? ''}
							onChange={(e) => {
								const value = e.target.value;
								onSetSeriesType(i, value === '' ? null : (value as PptxChartType));
							}}
						>
							{COMBO_SERIES_TYPE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{t(opt.labelKey)}
								</option>
							))}
						</select>
					</div>
				))}
			</div>
		</div>
	);
}
