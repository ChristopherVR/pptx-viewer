import type { PptxChartData, PptxChartType } from 'pptx-viewer-core';
import type { ChartTypeSelectValue } from 'pptx-viewer-shared';
import { resolveDisplayedChartType } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	CHART_TYPE_OPTIONS,
	GROUPING_OPTIONS,
	GROUPING_SUPPORTED_TYPES,
	HEADING,
	INPUT,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartTypeSelectorProps {
	title: string | undefined;
	chartType: PptxChartType;
	/**
	 * Full chart data, used only to resolve the "Pareto" display type (see
	 * `resolveDisplayedChartType`): a Pareto chart is `chartType: 'histogram'`
	 * plus a `paretoLine`-layout series and has no `PptxChartType` of its own,
	 * so the picker cannot tell it apart from `chartType` alone.
	 */
	chartData: Pick<PptxChartData, 'chartType' | 'series'>;
	grouping: PptxChartData['grouping'] | undefined;
	seriesCount: number;
	categoryCount: number;
	canEdit: boolean;
	onUpdateChartData: (patch: Partial<PptxChartData>) => void;
	/** Commits an edited flat title, collapsing multi-run rich text to the dominant style. */
	onTitleChange: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartTypeSelector({
	title,
	chartType,
	chartData,
	grouping,
	seriesCount,
	categoryCount,
	canEdit,
	onUpdateChartData,
	onTitleChange,
}: ChartTypeSelectorProps) {
	const { t } = useTranslation();
	const supportsGrouping = GROUPING_SUPPORTED_TYPES.has(chartType);
	const displayedType: ChartTypeSelectValue = resolveDisplayedChartType(chartData);

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.heading')}</div>
			<div className='text-[11px] text-muted-foreground mb-1'>
				{seriesCount} {t('pptx.chart.series')} &middot; {categoryCount} {t('pptx.chart.categories')}
			</div>

			{/* Title */}
			<label className='flex items-center gap-2 text-[11px]'>
				<span className='w-10 text-muted-foreground shrink-0'>{t('pptx.chart.title')}</span>
				<input
					type='text'
					disabled={!canEdit}
					className={INPUT}
					value={title ?? ''}
					onChange={(e) => onTitleChange(e.target.value)}
				/>
			</label>

			{/* Chart type selector */}
			<label className='flex items-center gap-2 text-[11px]'>
				<span className='w-10 text-muted-foreground shrink-0'>{t('pptx.chart.type')}</span>
				<select
					aria-label={t('pptx.chart.type')}
					disabled={!canEdit}
					className={INPUT}
					value={displayedType}
					onChange={(e) =>
						onUpdateChartData({
							chartType: e.target.value as PptxChartType,
						})
					}
				>
					{CHART_TYPE_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{t(opt.labelKey)}
						</option>
					))}
				</select>
			</label>

			{/* Grouping mode (bar/line/area only) */}
			{supportsGrouping && (
				<label className='flex items-center gap-2 text-[11px]'>
					<span className='w-10 text-muted-foreground shrink-0'>{t('pptx.chart.grouping')}</span>
					<select
						aria-label={t('pptx.chart.grouping')}
						disabled={!canEdit}
						className={INPUT}
						value={grouping ?? 'clustered'}
						onChange={(e) =>
							onUpdateChartData({
								grouping: e.target.value as PptxChartData['grouping'],
							})
						}
					>
						{GROUPING_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{t(opt.labelKey)}
							</option>
						))}
					</select>
				</label>
			)}
		</div>
	);
}
