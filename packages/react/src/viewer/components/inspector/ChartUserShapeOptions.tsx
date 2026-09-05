import type { PptxChartData } from 'pptx-viewer-core';
import {
	createDefaultChartUserShape,
	listChartUserShapeDescriptors,
	withChartUserShapeAdded,
	withChartUserShapeRemoved,
	withChartUserShapeUpdated,
} from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import { BTN, CARD, HEADING, INPUT } from './chart-panel-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartUserShapeOptionsProps {
	chartData: PptxChartData;
	canEdit: boolean;
	onUpdateChartData: (patch: Partial<PptxChartData>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * "Chart overlay shapes" section: list a chart's `c:userShapes` drawing
 * overlays, add a default text box, delete one, and nudge a `sp`/`cxnSp`
 * shape's anchor fractions. Purely a thin view over the shared
 * `pptx-viewer-shared` `chart-user-shape-edit` helpers (C2-G10 follow-up),
 * so every binding's inspector stays in lock-step (CLAUDE.md Rule 2).
 */
export function ChartUserShapeOptions({
	chartData,
	canEdit,
	onUpdateChartData,
}: ChartUserShapeOptionsProps) {
	const { t } = useTranslation();
	const shapes = chartData.userShapes;
	const descriptors = listChartUserShapeDescriptors(shapes);

	const kindLabel = (kind: string): string => {
		const key = `pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
		return t(key);
	};

	return (
		<div className={CARD}>
			<div className='flex items-center justify-between'>
				<div className={HEADING}>{t('pptx.chart.userShapes')}</div>
				<button
					type='button'
					disabled={!canEdit}
					className={BTN}
					onClick={() =>
						onUpdateChartData({
							userShapes: withChartUserShapeAdded(shapes, createDefaultChartUserShape()),
						})
					}
				>
					{t('pptx.chart.userShapeAddTextBox')}
				</button>
			</div>

			{descriptors.length === 0 ? (
				<div className='text-[11px] text-muted-foreground'>{t('pptx.chart.userShapesEmpty')}</div>
			) : (
				<div className='space-y-2'>
					{descriptors.map((d) => (
						<div key={d.index} className='space-y-1 rounded border border-border p-1.5'>
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='flex-1 truncate'>
									{kindLabel(d.kind)}
									{d.text ? ` - ${d.text}` : ''}
								</span>
								<button
									type='button'
									disabled={!canEdit}
									aria-label={t('pptx.chart.userShapeDelete')}
									className={BTN}
									onClick={() =>
										onUpdateChartData({ userShapes: withChartUserShapeRemoved(shapes, d.index) })
									}
								>
									✕
								</button>
							</div>

							{d.editable ? (
								<div className='flex items-center gap-1 text-[11px]'>
									<span className='text-muted-foreground'>{t('pptx.chart.userShapeFrom')}</span>
									<input
										type='number'
										step='0.01'
										min={0}
										max={1}
										disabled={!canEdit}
										className={INPUT}
										value={d.from.x}
										onChange={(e) =>
											onUpdateChartData({
												userShapes: withChartUserShapeUpdated(shapes, d.index, {
													from: { ...d.from, x: Number(e.target.value) },
												}),
											})
										}
									/>
									<input
										type='number'
										step='0.01'
										min={0}
										max={1}
										disabled={!canEdit}
										className={INPUT}
										value={d.from.y}
										onChange={(e) =>
											onUpdateChartData({
												userShapes: withChartUserShapeUpdated(shapes, d.index, {
													from: { ...d.from, y: Number(e.target.value) },
												}),
											})
										}
									/>
									{d.anchor === 'rel' && d.to ? (
										<>
											<span className='text-muted-foreground'>{t('pptx.chart.userShapeTo')}</span>
											<input
												type='number'
												step='0.01'
												min={0}
												max={1}
												disabled={!canEdit}
												className={INPUT}
												value={d.to.x}
												onChange={(e) =>
													onUpdateChartData({
														userShapes: withChartUserShapeUpdated(shapes, d.index, {
															to: { ...d.to!, x: Number(e.target.value) },
														}),
													})
												}
											/>
											<input
												type='number'
												step='0.01'
												min={0}
												max={1}
												disabled={!canEdit}
												className={INPUT}
												value={d.to.y}
												onChange={(e) =>
													onUpdateChartData({
														userShapes: withChartUserShapeUpdated(shapes, d.index, {
															to: { ...d.to!, y: Number(e.target.value) },
														}),
													})
												}
											/>
										</>
									) : null}
								</div>
							) : (
								<div className='text-[10px] italic text-muted-foreground'>
									{t('pptx.chart.userShapeNotEditable')}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
