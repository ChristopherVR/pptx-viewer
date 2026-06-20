import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { useTranslation } from 'react-i18next';

import { CARD, GRIDLINE_DASH_OPTIONS, HEADING, INPUT } from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartAxisStyleOptionsProps {
	axes: PptxChartAxisFormatting[] | undefined;
	canEdit: boolean;
	onSetLogScale: (
		axisType: PptxChartAxisFormatting['axisType'],
		opts: { enabled: boolean; base?: number },
	) => void;
	onSetTitleStyle: (
		axisType: PptxChartAxisFormatting['axisType'],
		edit: {
			fontFamily?: string | null;
			fontSize?: number | null;
			fontBold?: boolean;
			fontColor?: string | null;
		},
	) => void;
	onSetGridlineStyle: (
		axisType: PptxChartAxisFormatting['axisType'],
		which: 'major' | 'minor',
		edit: { color?: string | null; width?: number | null; dashStyle?: string | null },
	) => void;
}

/** Axis kinds that carry a numeric scale (and so support log scaling). */
const SCALE_AXES: ReadonlyArray<{ type: PptxChartAxisFormatting['axisType']; labelKey: string }> = [
	{ type: 'valAx', labelKey: 'pptx.chart.valueAxis' },
	{ type: 'dateAx', labelKey: 'pptx.chart.dateAxis' },
	{ type: 'catAx', labelKey: 'pptx.chart.categoryAxis' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartAxisStyleOptions({
	axes,
	canEdit,
	onSetLogScale,
	onSetTitleStyle,
	onSetGridlineStyle,
}: ChartAxisStyleOptionsProps) {
	const { t } = useTranslation();

	const rows = SCALE_AXES.map((row) => ({
		...row,
		axis: axes?.find((a) => a.axisType === row.type),
	})).filter((row): row is typeof row & { axis: PptxChartAxisFormatting } => Boolean(row.axis));

	if (rows.length === 0) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.axisStyling')}</div>
			{rows.map(({ type, labelKey, axis }) => {
				const hasScale = type === 'valAx' || type === 'dateAx';
				return (
					<div key={type} className='space-y-1.5'>
						<div className='text-[11px] font-medium'>{t(labelKey)}</div>
						<div className='space-y-1.5 ml-2'>
							{/* Logarithmic scale (value/date axes) */}
							{hasScale && (
								<div className='flex items-center gap-2'>
									<label className='flex items-center gap-2 cursor-pointer'>
										<input
											type='checkbox'
											disabled={!canEdit}
											checked={axis.logScale ?? false}
											onChange={(e) =>
												onSetLogScale(type, { enabled: e.target.checked, base: axis.logBase })
											}
											className='accent-primary'
										/>
										<span className='text-[11px]'>{t('pptx.chart.logScale')}</span>
									</label>
									{axis.logScale && (
										<input
											type='number'
											min={2}
											disabled={!canEdit}
											title={t('pptx.chart.logBase')}
											className='w-16 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]'
											value={axis.logBase ?? 10}
											onChange={(e) => {
												const num = Number.parseFloat(e.target.value);
												if (Number.isFinite(num) && num > 1) {
													onSetLogScale(type, { enabled: true, base: num });
												}
											}}
										/>
									)}
								</div>
							)}

							{/* Axis title font styling */}
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='w-12 text-muted-foreground shrink-0'>
									{t('pptx.chart.titleFont')}
								</span>
								<input
									type='text'
									disabled={!canEdit}
									className={INPUT}
									placeholder={t('pptx.chart.auto')}
									value={axis.fontFamily ?? ''}
									onChange={(e) => onSetTitleStyle(type, { fontFamily: e.target.value || null })}
								/>
								<input
									type='number'
									min={4}
									max={96}
									disabled={!canEdit}
									title={t('pptx.chart.fontSize')}
									className='w-14 bg-muted border border-border rounded px-1.5 py-0.5'
									value={axis.fontSize ?? ''}
									placeholder={t('pptx.chart.auto')}
									onChange={(e) => {
										const raw = e.target.value;
										const num = Number.parseFloat(raw);
										onSetTitleStyle(type, { fontSize: Number.isFinite(num) ? num : null });
									}}
								/>
							</div>
							<div className='flex items-center gap-3 text-[11px]'>
								<label className='flex items-center gap-1 cursor-pointer'>
									<input
										type='checkbox'
										disabled={!canEdit}
										checked={axis.fontBold ?? false}
										onChange={(e) => onSetTitleStyle(type, { fontBold: e.target.checked })}
										className='accent-primary'
									/>
									<span>{t('pptx.chart.bold')}</span>
								</label>
								<label className='flex items-center gap-1'>
									<span className='text-muted-foreground'>{t('pptx.chart.titleColor')}</span>
									<input
										type='color'
										disabled={!canEdit}
										className='h-6 w-8 cursor-pointer rounded border border-border bg-transparent'
										value={axis.fontColor ?? '#000000'}
										onChange={(e) => onSetTitleStyle(type, { fontColor: e.target.value })}
									/>
								</label>
							</div>

							{/* Major gridline styling */}
							{(['major', 'minor'] as const).map((which) => {
								const spPr = which === 'major' ? axis.majorGridlinesSpPr : axis.minorGridlinesSpPr;
								const enabled = which === 'major' ? axis.majorGridlines : axis.minorGridlines;
								if (!enabled) {
									return null;
								}
								return (
									<div key={which} className='flex items-center gap-2 text-[11px]'>
										<span className='w-12 text-muted-foreground shrink-0'>
											{t(
												which === 'major'
													? 'pptx.chart.majorGridlines'
													: 'pptx.chart.minorGridlines',
											)}
										</span>
										<input
											type='color'
											disabled={!canEdit}
											title={t('pptx.chart.gridlineColor')}
											className='h-6 w-8 cursor-pointer rounded border border-border bg-transparent'
											value={spPr?.strokeColor ?? '#d9d9d9'}
											onChange={(e) => onSetGridlineStyle(type, which, { color: e.target.value })}
										/>
										<input
											type='number'
											min={0.25}
											step={0.25}
											disabled={!canEdit}
											title={t('pptx.chart.gridlineWidth')}
											className='w-14 bg-muted border border-border rounded px-1.5 py-0.5'
											value={spPr?.strokeWidth ?? ''}
											placeholder={t('pptx.chart.auto')}
											onChange={(e) => {
												const num = Number.parseFloat(e.target.value);
												onSetGridlineStyle(type, which, {
													width: Number.isFinite(num) ? num : null,
												});
											}}
										/>
										<select
											disabled={!canEdit}
											title={t('pptx.chart.gridlineDash')}
											className={INPUT}
											value={spPr?.strokeDashStyle ?? ''}
											onChange={(e) =>
												onSetGridlineStyle(type, which, { dashStyle: e.target.value || null })
											}
										>
											{GRIDLINE_DASH_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{t(opt.labelKey)}
												</option>
											))}
										</select>
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
