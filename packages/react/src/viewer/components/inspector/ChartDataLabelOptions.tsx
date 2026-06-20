import type { PptxChartDataLabelOptions, PptxChartStyle } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	DATA_LABEL_CONTENT_OPTIONS,
	DATA_LABEL_POSITION_OPTIONS,
	HEADING,
	INPUT,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartDataLabelOptionsProps {
	style: PptxChartStyle | undefined;
	canEdit: boolean;
	onUpdateStyle: (patch: Partial<PptxChartStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartDataLabelOptions({
	style,
	canEdit,
	onUpdateStyle,
}: ChartDataLabelOptionsProps) {
	const { t } = useTranslation();

	// Only relevant once data labels are switched on (the master toggle lives
	// in ChartDisplayOptions).
	if (!style?.hasDataLabels) {
		return null;
	}

	const labels = style.dataLabels ?? {};

	const patchLabels = (patch: Partial<PptxChartDataLabelOptions>) =>
		onUpdateStyle({ dataLabels: { ...labels, ...patch } });

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.dataLabels')}</div>
			<div className='space-y-1.5'>
				{DATA_LABEL_CONTENT_OPTIONS.map((opt) => (
					<label key={opt.key} className='flex items-center gap-2 cursor-pointer'>
						<input
							type='checkbox'
							disabled={!canEdit}
							checked={labels[opt.key] ?? false}
							onChange={(e) => patchLabels({ [opt.key]: e.target.checked })}
							className='accent-primary'
						/>
						<span className='text-[11px]'>{t(opt.labelKey)}</span>
					</label>
				))}

				{/* Label position */}
				<label className='flex items-center gap-2 text-[11px]'>
					<span className='w-16 text-muted-foreground shrink-0'>
						{t('pptx.chart.labelPosition')}
					</span>
					<select
						disabled={!canEdit}
						className={INPUT}
						value={labels.position ?? ''}
						onChange={(e) =>
							patchLabels({
								position: (e.target.value || undefined) as PptxChartDataLabelOptions['position'],
							})
						}
					>
						{DATA_LABEL_POSITION_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{t(opt.labelKey)}
							</option>
						))}
					</select>
				</label>
			</div>
		</div>
	);
}
