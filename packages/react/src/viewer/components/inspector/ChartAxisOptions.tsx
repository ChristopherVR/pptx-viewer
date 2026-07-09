import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import {
	CARD,
	DISPLAY_UNITS_OPTIONS,
	HEADING,
	INPUT,
	TICK_LABEL_POSITION_OPTIONS,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartAxisOptionsProps {
	axes: PptxChartAxisFormatting[] | undefined;
	canEdit: boolean;
	onUpdateAxis: (
		axisType: PptxChartAxisFormatting['axisType'],
		patch: Partial<PptxChartAxisFormatting>,
	) => void;
}

/** Axis kinds the inspector exposes, with their label keys and whether they carry a numeric scale. */
const AXIS_ROWS: ReadonlyArray<{
	type: PptxChartAxisFormatting['axisType'];
	labelKey: string;
	hasScale: boolean;
}> = [
	{ type: 'valAx', labelKey: 'pptx.chart.valueAxis', hasScale: true },
	{ type: 'dateAx', labelKey: 'pptx.chart.dateAxis', hasScale: true },
	{ type: 'catAx', labelKey: 'pptx.chart.categoryAxis', hasScale: false },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartAxisOptions({ axes, canEdit, onUpdateAxis }: ChartAxisOptionsProps) {
	const { t } = useTranslation();

	// Only render axes that actually exist on the chart (e.g. pie charts have none).
	const rows = AXIS_ROWS.map((row) => ({
		...row,
		axis: axes?.find((a) => a.axisType === row.type),
	})).filter((row): row is typeof row & { axis: PptxChartAxisFormatting } => Boolean(row.axis));

	if (rows.length === 0) {
		return null;
	}

	const numberField = (
		axisType: PptxChartAxisFormatting['axisType'],
		labelKey: string,
		value: number | undefined,
		key: 'min' | 'max' | 'majorUnit' | 'minorUnit',
	) => (
		<label className='flex items-center gap-2 text-[11px]'>
			<span className='w-16 text-muted-foreground shrink-0'>{t(labelKey)}</span>
			<input
				type='number'
				disabled={!canEdit}
				className={INPUT}
				value={value ?? ''}
				placeholder={t('pptx.chart.auto')}
				onChange={(e) => {
					const raw = e.target.value;
					if (raw === '') {
						onUpdateAxis(axisType, { [key]: undefined });
						return;
					}
					const num = Number.parseFloat(raw);
					if (Number.isFinite(num)) {
						onUpdateAxis(axisType, { [key]: num });
					}
				}}
			/>
		</label>
	);

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.axes')}</div>
			{rows.map(({ type, labelKey, hasScale, axis }) => (
				<div key={type} className='space-y-1.5'>
					<div className='text-[11px] font-medium'>{t(labelKey)}</div>

					{hasScale && (
						<div className='space-y-1.5 ml-2'>
							{numberField(type, 'pptx.chart.min', axis.min, 'min')}
							{numberField(type, 'pptx.chart.max', axis.max, 'max')}
							{numberField(type, 'pptx.chart.majorUnit', axis.majorUnit, 'majorUnit')}
							{numberField(type, 'pptx.chart.minorUnit', axis.minorUnit, 'minorUnit')}

							{/* Display units */}
							<label className='flex items-center gap-2 text-[11px]'>
								<span className='w-16 text-muted-foreground shrink-0'>
									{t('pptx.chart.displayUnits')}
								</span>
								<select
									disabled={!canEdit}
									className={INPUT}
									value={axis.displayUnits ?? ''}
									onChange={(e) =>
										onUpdateAxis(type, {
											displayUnits: (e.target.value ||
												undefined) as PptxChartAxisFormatting['displayUnits'],
										})
									}
								>
									{DISPLAY_UNITS_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{t(opt.labelKey)}
										</option>
									))}
								</select>
							</label>
						</div>
					)}

					<div className='space-y-1.5 ml-2'>
						{/* Axis title */}
						<label className='flex items-center gap-2 text-[11px]'>
							<span className='w-16 text-muted-foreground shrink-0'>
								{t('pptx.chart.axisTitle')}
							</span>
							<input
								type='text'
								disabled={!canEdit}
								className={INPUT}
								value={axis.titleText ?? ''}
								placeholder={t('pptx.chart.axisTitlePlaceholder')}
								onChange={(e) => onUpdateAxis(type, { titleText: e.target.value })}
							/>
						</label>

						{/* Number format */}
						<label className='flex items-center gap-2 text-[11px]'>
							<span className='w-16 text-muted-foreground shrink-0'>
								{t('pptx.chart.numberFormat')}
							</span>
							<input
								type='text'
								disabled={!canEdit}
								className={INPUT}
								value={axis.numFmt?.formatCode ?? ''}
								placeholder={t('pptx.settings.general')}
								onChange={(e) =>
									onUpdateAxis(type, {
										numFmt: e.target.value
											? { formatCode: e.target.value, sourceLinked: false }
											: undefined,
									})
								}
							/>
						</label>

						{/* Tick label position */}
						<label className='flex items-center gap-2 text-[11px]'>
							<span className='w-16 text-muted-foreground shrink-0'>
								{t('pptx.chart.tickLabels')}
							</span>
							<select
								disabled={!canEdit}
								className={INPUT}
								value={axis.tickLblPos ?? 'nextTo'}
								onChange={(e) =>
									onUpdateAxis(type, {
										tickLblPos: e.target.value as PptxChartAxisFormatting['tickLblPos'],
									})
								}
							>
								{TICK_LABEL_POSITION_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{t(opt.labelKey)}
									</option>
								))}
							</select>
						</label>

						{/* Gridlines */}
						<label className='flex items-center gap-2 cursor-pointer'>
							<input
								type='checkbox'
								disabled={!canEdit}
								checked={axis.majorGridlines ?? false}
								onChange={(e) => onUpdateAxis(type, { majorGridlines: e.target.checked })}
								className='accent-primary'
							/>
							<span className='text-[11px]'>{t('pptx.chart.majorGridlines')}</span>
						</label>
						<label className='flex items-center gap-2 cursor-pointer'>
							<input
								type='checkbox'
								disabled={!canEdit}
								checked={axis.minorGridlines ?? false}
								onChange={(e) => onUpdateAxis(type, { minorGridlines: e.target.checked })}
								className='accent-primary'
							/>
							<span className='text-[11px]'>{t('pptx.chart.minorGridlines')}</span>
						</label>
					</div>
				</div>
			))}
		</div>
	);
}
