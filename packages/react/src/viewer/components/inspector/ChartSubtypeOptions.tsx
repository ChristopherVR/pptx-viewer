import type { PptxBar3DShape, PptxChartData } from 'pptx-viewer-core';
import {
	BAR3D_SHAPE_OPTIONS,
	bar3DShapePatch,
	RADAR_STYLE_OPTIONS,
	radarStylePatch,
	SURFACE_WIREFRAME_OPTIONS,
	surfaceWireframePatch,
} from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import { CARD, HEADING, INPUT } from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartSubtypeOptionsProps {
	chartData: PptxChartData;
	canEdit: boolean;
	/** `bar3DShapePatch`/`radarStylePatch`/`surfaceWireframePatch` applied through the normal update-element path. */
	onUpdateChartData: (patch: Partial<PptxChartData>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The three OOXML chart-subtype pickers (`c:bar3DChart/c:shape`,
 * `c:radarChart/c:radarStyle`, `c:surfaceChart|surface3DChart/c:wireframe`),
 * each shown only for the chart family it applies to. The option lists and
 * the patch each selection commits live in `pptx-viewer-shared`
 * (`chart-subtype-options.ts`) so all five bindings offer the identical
 * gallery; this component only maps the descriptors onto a `<select>`.
 */
export function ChartSubtypeOptions({
	chartData,
	canEdit,
	onUpdateChartData,
}: ChartSubtypeOptionsProps) {
	const { t } = useTranslation();

	if (
		chartData.chartType !== 'bar3D' &&
		chartData.chartType !== 'radar' &&
		chartData.chartType !== 'surface'
	) {
		return null;
	}

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.chart.display')}</div>
			<div className='space-y-1.5'>
				{chartData.chartType === 'bar3D' && (
					<label className='flex items-center gap-2 text-[11px]'>
						<span className='w-16 text-muted-foreground shrink-0'>
							{t('pptx.chart.bar3DShapeLabel')}
						</span>
						<select
							data-testid='pptx-chart-bar3d-shape'
							aria-label={t('pptx.chart.bar3DShapeLabel')}
							disabled={!canEdit}
							className={INPUT}
							value={chartData.barShape ?? 'box'}
							onChange={(e) =>
								onUpdateChartData(bar3DShapePatch(chartData, e.target.value as PptxBar3DShape))
							}
						>
							{BAR3D_SHAPE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{t(opt.labelKey)}
								</option>
							))}
						</select>
					</label>
				)}

				{chartData.chartType === 'radar' && (
					<label className='flex items-center gap-2 text-[11px]'>
						<span className='w-16 text-muted-foreground shrink-0'>
							{t('pptx.chart.radarStyleLabel')}
						</span>
						<select
							data-testid='pptx-chart-radar-style'
							aria-label={t('pptx.chart.radarStyleLabel')}
							disabled={!canEdit}
							className={INPUT}
							value={chartData.radarStyle ?? 'standard'}
							onChange={(e) =>
								onUpdateChartData(
									radarStylePatch(
										chartData,
										e.target.value as NonNullable<PptxChartData['radarStyle']>,
									),
								)
							}
						>
							{RADAR_STYLE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{t(opt.labelKey)}
								</option>
							))}
						</select>
					</label>
				)}

				{chartData.chartType === 'surface' && (
					<label className='flex items-center gap-2 text-[11px]'>
						<span className='w-16 text-muted-foreground shrink-0'>
							{t('pptx.chart.surfaceWireframeLabel')}
						</span>
						<select
							data-testid='pptx-chart-surface-wireframe'
							aria-label={t('pptx.chart.surfaceWireframeLabel')}
							disabled={!canEdit}
							className={INPUT}
							value={chartData.wireframe ? 'true' : 'false'}
							onChange={(e) =>
								onUpdateChartData(surfaceWireframePatch(chartData, e.target.value === 'true'))
							}
						>
							{SURFACE_WIREFRAME_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{t(opt.labelKey)}
								</option>
							))}
						</select>
					</label>
				)}
			</div>
		</div>
	);
}
