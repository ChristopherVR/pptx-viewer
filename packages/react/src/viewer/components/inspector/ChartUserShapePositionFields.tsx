import type { PptxChartUserShape } from 'pptx-viewer-core';
import type { ChartUserShapeRow, ChartUserShapeRowPatch } from 'pptx-viewer-shared';
import { getChartUserShapeRowChartBox } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import { INPUT } from './chart-panel-constants';

/** A `from`/`to` fraction-pair patch for a nested row, see `getChartUserShapeRowChartBox`'s doc. */
export interface ChartUserShapeRowBoxPatch {
	from: { x: number; y: number };
	to: { x: number; y: number };
}

export interface ChartUserShapePositionFieldsProps {
	row: ChartUserShapeRow;
	/** The chart's full overlay tree, needed to resolve a nested row's ancestor group chain. */
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined;
	canEdit: boolean;
	onPatch: (path: readonly number[], patch: ChartUserShapeRowPatch) => void;
	/** Applies a nested row's `from`/`to` fraction edit (see `withChartUserShapeRowChartBoxUpdated`). */
	onBoxPatch: (path: readonly number[], box: ChartUserShapeRowBoxPatch) => void;
	/** Applies this row's own rotation edit (see `withChartUserShapeRowRotationUpdated`). */
	onRotationPatch: (path: readonly number[], rotation: number | undefined) => void;
	/** Applies this row's own flip edit (see `withChartUserShapeRowFlipUpdated`). */
	onFlipPatch: (path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }) => void;
}

interface NumberFieldProps {
	value: number;
	canEdit: boolean;
	fraction?: boolean;
	nonNegative?: boolean;
	onChange: (value: number) => void;
}

function NumberField({ value, canEdit, fraction, nonNegative, onChange }: NumberFieldProps) {
	return (
		<input
			type='number'
			step={fraction ? '0.01' : undefined}
			min={fraction || nonNegative ? 0 : undefined}
			max={fraction ? 1 : undefined}
			disabled={!canEdit}
			className={INPUT}
			value={value}
			onChange={(e) => onChange(Number(e.target.value))}
		/>
	);
}

/**
 * This row's own rotation (degrees): a `grpSp` row's own `transform.rotation`
 * (rotates the whole group), or a leaf's own rotation. Applies to every row,
 * top-level or nested (see `withChartUserShapeRowRotationUpdated`'s doc).
 */
function RotationField({
	row,
	canEdit,
	onRotationPatch,
}: {
	row: ChartUserShapeRow;
	canEdit: boolean;
	onRotationPatch: (path: readonly number[], rotation: number | undefined) => void;
}) {
	const { t } = useTranslation();
	return (
		<>
			<span className='text-muted-foreground'>{t('pptx.chart.userShapeRotation')}</span>
			<input
				type='number'
				step='1'
				aria-label={t('pptx.chart.userShapeRotation')}
				disabled={!canEdit}
				className={INPUT}
				value={row.rotation ?? 0}
				onChange={(e) => onRotationPatch(row.path, Number(e.target.value) || undefined)}
			/>
		</>
	);
}

/**
 * This row's own flip flags: a `grpSp` row's own `transform.flipH`/`flipV`
 * (flips the whole group), or a leaf's own `flipH`/`flipV`. Applies to every
 * row, top-level or nested (see `withChartUserShapeRowFlipUpdated`'s doc).
 */
function FlipFields({
	row,
	canEdit,
	onFlipPatch,
}: {
	row: ChartUserShapeRow;
	canEdit: boolean;
	onFlipPatch: (path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }) => void;
}) {
	const { t } = useTranslation();
	return (
		<>
			<label className='flex items-center gap-1 cursor-pointer'>
				<input
					type='checkbox'
					aria-label={t('pptx.arrange.flipHorizontally')}
					disabled={!canEdit}
					className='accent-primary'
					checked={row.flipH ?? false}
					onChange={(e) => onFlipPatch(row.path, { flipH: e.target.checked })}
				/>
				<span className='text-muted-foreground'>{t('pptx.arrange.flipHorizontally')}</span>
			</label>
			<label className='flex items-center gap-1 cursor-pointer'>
				<input
					type='checkbox'
					aria-label={t('pptx.arrange.flipVertically')}
					disabled={!canEdit}
					className='accent-primary'
					checked={row.flipV ?? false}
					onChange={(e) => onFlipPatch(row.path, { flipV: e.target.checked })}
				/>
				<span className='text-muted-foreground'>{t('pptx.arrange.flipVertically')}</span>
			</label>
		</>
	);
}

/**
 * Position/size editor for one chart overlay row. A top-level row edits its
 * anchor markers directly (rel `from`/`to` fractions, or abs `from` + `ext`
 * EMU: a top-level `grpSp` row's anchor already moves/resizes the whole
 * group with children following, see `chart-user-shape-tree.ts`'s
 * `editablePosition` doc). A nested (grouped-child) row, INCLUDING a nested
 * `grpSp` group header, edits a `from`/`to` chart-relative fraction pair
 * instead of raw EMU (`chart-user-shape-row-frame.ts`'s
 * `getChartUserShapeRowChartBox`/`withChartUserShapeRowChartBoxUpdated`),
 * matching how a top-level `relSizeAnchor` row already edits.
 */
export function ChartUserShapePositionFields({
	row,
	userShapes,
	canEdit,
	onPatch,
	onBoxPatch,
	onRotationPatch,
	onFlipPatch,
}: ChartUserShapePositionFieldsProps) {
	const { t } = useTranslation();
	const update = (patch: ChartUserShapeRowPatch) => onPatch(row.path, patch);

	if (row.depth === 0) {
		const from = row.from!;
		return (
			<div className='flex flex-wrap items-center gap-1 text-[11px]'>
				<span className='text-muted-foreground'>{t('pptx.chart.userShapeFrom')}</span>
				<NumberField
					fraction
					canEdit={canEdit}
					value={from.x}
					onChange={(x) => update({ from: { ...from, x } })}
				/>
				<NumberField
					fraction
					canEdit={canEdit}
					value={from.y}
					onChange={(y) => update({ from: { ...from, y } })}
				/>
				{row.anchor === 'rel' && row.to ? (
					<>
						<span className='text-muted-foreground'>{t('pptx.chart.userShapeTo')}</span>
						<NumberField
							fraction
							canEdit={canEdit}
							value={row.to.x}
							onChange={(x) => update({ to: { ...row.to!, x } })}
						/>
						<NumberField
							fraction
							canEdit={canEdit}
							value={row.to.y}
							onChange={(y) => update({ to: { ...row.to!, y } })}
						/>
					</>
				) : null}
				{row.anchor === 'abs' && row.ext ? (
					<>
						<span className='text-muted-foreground'>{t('pptx.chart.userShapeSize')}</span>
						<NumberField
							nonNegative
							canEdit={canEdit}
							value={row.ext.cx}
							onChange={(cx) => update({ ext: { ...row.ext!, cx } })}
						/>
						<NumberField
							nonNegative
							canEdit={canEdit}
							value={row.ext.cy}
							onChange={(cy) => update({ ext: { ...row.ext!, cy } })}
						/>
					</>
				) : null}
				<RotationField row={row} canEdit={canEdit} onRotationPatch={onRotationPatch} />
				<FlipFields row={row} canEdit={canEdit} onFlipPatch={onFlipPatch} />
			</div>
		);
	}

	const box = getChartUserShapeRowChartBox(userShapes, row.path);
	if (!box) {
		return null;
	}
	const patchBox = (next: Partial<ChartUserShapeRowBoxPatch>) =>
		onBoxPatch(row.path, { from: box.from, to: box.to, ...next });
	return (
		<div className='flex flex-wrap items-center gap-1 text-[11px]'>
			<span className='text-muted-foreground'>{t('pptx.chart.userShapeFrom')}</span>
			<NumberField
				fraction
				canEdit={canEdit}
				value={box.from.x}
				onChange={(x) => patchBox({ from: { ...box.from, x } })}
			/>
			<NumberField
				fraction
				canEdit={canEdit}
				value={box.from.y}
				onChange={(y) => patchBox({ from: { ...box.from, y } })}
			/>
			<span className='text-muted-foreground'>{t('pptx.chart.userShapeTo')}</span>
			<NumberField
				fraction
				canEdit={canEdit}
				value={box.to.x}
				onChange={(x) => patchBox({ to: { ...box.to, x } })}
			/>
			<NumberField
				fraction
				canEdit={canEdit}
				value={box.to.y}
				onChange={(y) => patchBox({ to: { ...box.to, y } })}
			/>
			<RotationField row={row} canEdit={canEdit} onRotationPatch={onRotationPatch} />
			<FlipFields row={row} canEdit={canEdit} onFlipPatch={onFlipPatch} />
		</div>
	);
}
