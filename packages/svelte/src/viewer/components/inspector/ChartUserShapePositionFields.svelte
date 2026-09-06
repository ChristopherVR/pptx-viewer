<script lang="ts">
	/**
	 * ChartUserShapePositionFields: position/size editor for one chart overlay
	 * row (W2-F), split out of `ChartUserShapeSection.svelte`.
	 *
	 * A top-level row edits its anchor markers directly (rel `from`/`to`
	 * fractions, or abs `from` + `ext` EMU: a top-level `grpSp` row's anchor
	 * already moves/resizes the whole group with children following, see
	 * shared `chart-user-shape-tree.ts`'s `editablePosition` doc). A nested
	 * row, INCLUDING a nested `grpSp` group header, edits a `from`/`to`
	 * chart-relative fraction pair instead of raw EMU (shared
	 * `chart-user-shape-row-frame.ts`), matching how a top-level
	 * `relSizeAnchor` row already edits.
	 */
	import type { PptxChartUserShape } from 'pptx-viewer-core';
	import type { ChartUserShapeRow, ChartUserShapeRowPatch } from 'pptx-viewer-shared';
	import { getChartUserShapeRowChartBox } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		row,
		userShapes,
		canEdit,
		onpatch,
		onboxpatch,
		onrotationpatch,
		onflippatch,
	}: {
		row: ChartUserShapeRow;
		/** The chart's full overlay tree, needed to resolve a nested row's ancestor group chain. */
		userShapes: ReadonlyArray<PptxChartUserShape> | undefined;
		canEdit: boolean;
		onpatch: (path: number[], patch: ChartUserShapeRowPatch) => void;
		onboxpatch: (path: number[], box: { from: Point; to: Point }) => void;
		/** This row's own rotation edit (see `withChartUserShapeRowRotationUpdated`). */
		onrotationpatch: (path: number[], rotation: number | undefined) => void;
		/** This row's own flip edit (see `withChartUserShapeRowFlipUpdated`). */
		onflippatch: (path: number[], flip: { flipH?: boolean; flipV?: boolean }) => void;
	} = $props();
	const t = useTranslator();

	type Point = { x: number; y: number };
	type Size = { cx: number; cy: number };

	const box = $derived(getChartUserShapeRowChartBox(userShapes, row.path));

	function point(key: 'from' | 'to' | 'off', base: Point, axis: 'x' | 'y', value: string): void {
		onpatch(row.path, { [key]: { ...base, [axis]: Number(value) } });
	}

	function size(base: Size, axis: 'cx' | 'cy', value: string): void {
		onpatch(row.path, { ext: { ...base, [axis]: Number(value) } });
	}

	function boxPoint(key: 'from' | 'to', current: { from: Point; to: Point }, axis: 'x' | 'y', value: string): void {
		onboxpatch(row.path, { ...current, [key]: { ...current[key], [axis]: Number(value) } });
	}

	function rotation(value: string): void {
		const next = Number(value);
		onrotationpatch(row.path, next || undefined);
	}

	function flipH(checked: boolean): void {
		onflippatch(row.path, { flipH: checked });
	}

	function flipV(checked: boolean): void {
		onflippatch(row.path, { flipV: checked });
	}
</script>

{#if row.depth === 0}
	<div class="anchor">
		<span>{t('pptx.chart.userShapeFrom')}</span>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			disabled={!canEdit}
			value={row.from!.x}
			onchange={(event) => point('from', row.from!, 'x', event.currentTarget.value)}
		/>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			disabled={!canEdit}
			value={row.from!.y}
			onchange={(event) => point('from', row.from!, 'y', event.currentTarget.value)}
		/>
		{#if row.anchor === 'rel' && row.to}
			<span>{t('pptx.chart.userShapeTo')}</span>
			<input
				type="number"
				step="0.01"
				min="0"
				max="1"
				disabled={!canEdit}
				value={row.to.x}
				onchange={(event) => point('to', row.to!, 'x', event.currentTarget.value)}
			/>
			<input
				type="number"
				step="0.01"
				min="0"
				max="1"
				disabled={!canEdit}
				value={row.to.y}
				onchange={(event) => point('to', row.to!, 'y', event.currentTarget.value)}
			/>
		{/if}
		{#if row.anchor === 'abs' && row.ext}
			<span>{t('pptx.chart.userShapeSize')}</span>
			<input
				type="number"
				min="0"
				disabled={!canEdit}
				value={row.ext.cx}
				onchange={(event) => size(row.ext!, 'cx', event.currentTarget.value)}
			/>
			<input
				type="number"
				min="0"
				disabled={!canEdit}
				value={row.ext.cy}
				onchange={(event) => size(row.ext!, 'cy', event.currentTarget.value)}
			/>
		{/if}
		<span>{t('pptx.chart.userShapeRotation')}</span>
		<input
			type="number"
			step="1"
			aria-label={t('pptx.chart.userShapeRotation')}
			disabled={!canEdit}
			value={row.rotation ?? 0}
			onchange={(event) => rotation(event.currentTarget.value)}
		/>
		<label class="toggle">
			<input
				type="checkbox"
				aria-label={t('pptx.arrange.flipHorizontally')}
				disabled={!canEdit}
				checked={row.flipH ?? false}
				onchange={(event) => flipH(event.currentTarget.checked)}
			/>
			{t('pptx.arrange.flipHorizontally')}
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				aria-label={t('pptx.arrange.flipVertically')}
				disabled={!canEdit}
				checked={row.flipV ?? false}
				onchange={(event) => flipV(event.currentTarget.checked)}
			/>
			{t('pptx.arrange.flipVertically')}
		</label>
	</div>
{:else if box}
	<div class="anchor">
		<span>{t('pptx.chart.userShapeFrom')}</span>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			disabled={!canEdit}
			value={box.from.x}
			onchange={(event) => boxPoint('from', box, 'x', event.currentTarget.value)}
		/>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			disabled={!canEdit}
			value={box.from.y}
			onchange={(event) => boxPoint('from', box, 'y', event.currentTarget.value)}
		/>
		<span>{t('pptx.chart.userShapeTo')}</span>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			disabled={!canEdit}
			value={box.to.x}
			onchange={(event) => boxPoint('to', box, 'x', event.currentTarget.value)}
		/>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			disabled={!canEdit}
			value={box.to.y}
			onchange={(event) => boxPoint('to', box, 'y', event.currentTarget.value)}
		/>
		<span>{t('pptx.chart.userShapeRotation')}</span>
		<input
			type="number"
			step="1"
			aria-label={t('pptx.chart.userShapeRotation')}
			disabled={!canEdit}
			value={row.rotation ?? 0}
			onchange={(event) => rotation(event.currentTarget.value)}
		/>
		<label class="toggle">
			<input
				type="checkbox"
				aria-label={t('pptx.arrange.flipHorizontally')}
				disabled={!canEdit}
				checked={row.flipH ?? false}
				onchange={(event) => flipH(event.currentTarget.checked)}
			/>
			{t('pptx.arrange.flipHorizontally')}
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				aria-label={t('pptx.arrange.flipVertically')}
				disabled={!canEdit}
				checked={row.flipV ?? false}
				onchange={(event) => flipV(event.currentTarget.checked)}
			/>
			{t('pptx.arrange.flipVertically')}
		</label>
	</div>
{/if}

<style>
	.anchor {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		margin: 3px 0 5px;
	}
	.anchor input[type='number'] {
		width: 0;
		flex: 1;
		min-width: 0;
		height: 22px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-background);
		color: inherit;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}
</style>
