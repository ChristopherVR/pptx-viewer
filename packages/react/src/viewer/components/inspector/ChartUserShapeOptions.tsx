import type { PptxChartData } from 'pptx-viewer-core';
import {
	createDefaultChartUserShape,
	createDefaultChartUserShapeGroupChild,
	getChartUserShapeGroupTransform,
	listChartUserShapeRows,
	withChartUserShapeAdded,
	withChartUserShapeGroupChildAdded,
	withChartUserShapeRowChartBoxUpdated,
	withChartUserShapeRowFlipUpdated,
	withChartUserShapeRowRemoved,
	withChartUserShapeRowRotationUpdated,
	withChartUserShapeRowTextUpdated,
	withChartUserShapeRowUpdated,
} from 'pptx-viewer-shared';
import type { ChartUserShapeRowPatch } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import { BTN, CARD, HEADING, INPUT } from './chart-panel-constants';
import type { ChartUserShapeRowBoxPatch } from './ChartUserShapePositionFields';
import { ChartUserShapePositionFields } from './ChartUserShapePositionFields';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartUserShapeOptionsProps {
	chartData: PptxChartData;
	canEdit: boolean;
	onUpdateChartData: (patch: Partial<PptxChartData>) => void;
}

const PATH_KEY = (path: readonly number[]): string => path.join(',');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * "Chart overlay shapes" section: list a chart's `c:userShapes` drawing
 * overlays as an indented tree (a `grpSp`'s grouped children included, W2-F),
 * add a default text box, delete any row, and edit a `sp`/`cxnSp` row's text/
 * fill/line, a `pic` row's alt text, and any non-group row's position/size.
 * Purely a thin view over the shared `pptx-viewer-shared` `chart-user-shape-
 * edit`/`chart-user-shape-tree` helpers, so every binding's inspector stays
 * in lock-step (CLAUDE.md Rule 2).
 */
export function ChartUserShapeOptions({
	chartData,
	canEdit,
	onUpdateChartData,
}: ChartUserShapeOptionsProps) {
	const { t } = useTranslation();
	const shapes = chartData.userShapes;
	const rows = listChartUserShapeRows(shapes);

	const kindLabel = (kind: string): string => {
		const key = `pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
		return t(key);
	};

	const update = (path: readonly number[], patch: ChartUserShapeRowPatch) =>
		onUpdateChartData({ userShapes: withChartUserShapeRowUpdated(shapes, path, patch) });

	const updateBox = (path: readonly number[], box: ChartUserShapeRowBoxPatch) =>
		onUpdateChartData({ userShapes: withChartUserShapeRowChartBoxUpdated(shapes, path, box) });

	const updateRotation = (path: readonly number[], rotation: number | undefined) =>
		onUpdateChartData({ userShapes: withChartUserShapeRowRotationUpdated(shapes, path, rotation) });

	const updateFlip = (path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }) =>
		onUpdateChartData({ userShapes: withChartUserShapeRowFlipUpdated(shapes, path, flip) });

	const addIntoGroup = (path: readonly number[]) => {
		const transform = getChartUserShapeGroupTransform(shapes, path);
		if (!transform) {
			return;
		}
		onUpdateChartData({
			userShapes: withChartUserShapeGroupChildAdded(
				shapes,
				path,
				createDefaultChartUserShapeGroupChild(transform),
			),
		});
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

			{rows.length === 0 ? (
				<div className='text-[11px] text-muted-foreground'>{t('pptx.chart.userShapesEmpty')}</div>
			) : (
				<div className='space-y-2'>
					{rows.map((row) => (
						<div
							key={PATH_KEY(row.path)}
							data-chart-user-shape-path={PATH_KEY(row.path)}
							style={{ marginLeft: row.depth * 12 }}
							className='space-y-1 rounded border border-border p-1.5'
						>
							<div className='flex items-center gap-2 text-[11px]'>
								<span className='flex-1 truncate'>
									{kindLabel(row.kind)}
									{row.text ? ` - ${row.text}` : ''}
								</span>
								{row.isGroup ? (
									<button
										type='button'
										disabled={!canEdit}
										className={BTN}
										onClick={() => addIntoGroup(row.path)}
									>
										{t('pptx.chart.userShapeAddIntoGroup')}
									</button>
								) : null}
								<button
									type='button'
									disabled={!canEdit}
									aria-label={t('pptx.chart.userShapeDelete')}
									className={BTN}
									onClick={() =>
										onUpdateChartData({
											userShapes: withChartUserShapeRowRemoved(shapes, row.path),
										})
									}
								>
									✕
								</button>
							</div>

							{row.editableVisuals ? (
								<div className='flex items-center gap-1 text-[11px]'>
									<span className='text-muted-foreground'>{t('pptx.chart.userShapeText')}</span>
									<input
										type='text'
										aria-label={t('pptx.chart.userShapeText')}
										disabled={!canEdit}
										className={INPUT}
										value={row.text ?? ''}
										onChange={(e) =>
											onUpdateChartData({
												userShapes: withChartUserShapeRowTextUpdated(
													shapes,
													row.path,
													e.target.value,
												),
											})
										}
									/>
								</div>
							) : null}

							{row.editableVisuals ? (
								<div className='flex items-center gap-3 text-[11px]'>
									<label className='flex items-center gap-1'>
										<span className='text-muted-foreground'>{t('pptx.chart.userShapeFill')}</span>
										<input
											type='color'
											aria-label={t('pptx.chart.userShapeFill')}
											disabled={!canEdit}
											value={row.fill ?? '#ffffff'}
											onChange={(e) => update(row.path, { fill: e.target.value })}
										/>
									</label>
									<label className='flex items-center gap-1'>
										<span className='text-muted-foreground'>{t('pptx.chart.userShapeStroke')}</span>
										<input
											type='color'
											aria-label={t('pptx.chart.userShapeStroke')}
											disabled={!canEdit}
											value={row.stroke ?? '#000000'}
											onChange={(e) => update(row.path, { stroke: e.target.value })}
										/>
									</label>
								</div>
							) : null}

							{row.editableAltText ? (
								<div className='flex items-center gap-1 text-[11px]'>
									<span className='text-muted-foreground'>{t('pptx.chart.userShapeAltText')}</span>
									<input
										type='text'
										aria-label={t('pptx.chart.userShapeAltText')}
										disabled={!canEdit}
										className={INPUT}
										value={row.altText ?? ''}
										onChange={(e) => update(row.path, { altText: e.target.value })}
									/>
								</div>
							) : null}

							{/* Every row (including a grpSp group header) is now position/size
							editable: a top-level group's own drawing anchor moves/resizes it,
							and a nested row edits a chart-relative fraction, see
							ChartUserShapePositionFields' doc. */}
							<ChartUserShapePositionFields
								row={row}
								userShapes={shapes}
								canEdit={canEdit}
								onPatch={update}
								onBoxPatch={updateBox}
								onRotationPatch={updateRotation}
								onFlipPatch={updateFlip}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
