<script lang="ts">
	/**
	 * ChartUserShapeSection: "Chart overlay shapes" section (`c:userShapes`
	 * drawing overlay), mirroring React's `inspector/ChartUserShapeOptions.tsx`.
	 *
	 * Lists existing overlay shapes as an indented tree (a `grpSp`'s grouped
	 * children included, W2-F), adds a default text box, deletes any row, and
	 * edits a `sp`/`cxnSp` row's text/fill/line, a `pic` row's alt text, and
	 * any non-group row's position/size. Pure view over `pptx-viewer-shared`'s
	 * `chart-user-shape-edit`/`chart-user-shape-tree` helpers.
	 */
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

	import { useTranslator } from '../../../i18n/context';
	import ChartUserShapePositionFields from './ChartUserShapePositionFields.svelte';

	const {
		data,
		canEdit,
		onpatch,
	}: {
		data: PptxChartData;
		canEdit: boolean;
		onpatch: (patch: Partial<PptxChartData>) => void;
	} = $props();
	const t = useTranslator();

	const rows = $derived(listChartUserShapeRows(data.userShapes));

	function kindLabel(kind: string): string {
		return t(`pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);
	}

	function addTextBox(): void {
		onpatch({ userShapes: withChartUserShapeAdded(data.userShapes, createDefaultChartUserShape()) });
	}

	function removeRow(path: number[]): void {
		onpatch({ userShapes: withChartUserShapeRowRemoved(data.userShapes, path) });
	}

	function updateRow(path: number[], patch: ChartUserShapeRowPatch): void {
		onpatch({ userShapes: withChartUserShapeRowUpdated(data.userShapes, path, patch) });
	}

	function updateText(path: number[], text: string): void {
		onpatch({ userShapes: withChartUserShapeRowTextUpdated(data.userShapes, path, text) });
	}

	function updateBox(path: number[], box: { from: { x: number; y: number }; to: { x: number; y: number } }): void {
		onpatch({ userShapes: withChartUserShapeRowChartBoxUpdated(data.userShapes, path, box) });
	}

	function updateRotation(path: number[], rotation: number | undefined): void {
		onpatch({ userShapes: withChartUserShapeRowRotationUpdated(data.userShapes, path, rotation) });
	}

	function updateFlip(path: number[], flip: { flipH?: boolean; flipV?: boolean }): void {
		onpatch({ userShapes: withChartUserShapeRowFlipUpdated(data.userShapes, path, flip) });
	}

	function addIntoGroup(path: number[]): void {
		const transform = getChartUserShapeGroupTransform(data.userShapes, path);
		if (!transform) {
			return;
		}
		onpatch({
			userShapes: withChartUserShapeGroupChildAdded(
				data.userShapes,
				path,
				createDefaultChartUserShapeGroupChild(transform),
			),
		});
	}
</script>

<div class="pptx-svelte-chart-usershapes">
	<div class="header">
		<h5>{t('pptx.chart.userShapes')}</h5>
		<button type="button" disabled={!canEdit} onclick={addTextBox}>
			{t('pptx.chart.userShapeAddTextBox')}
		</button>
	</div>
	{#if rows.length === 0}
		<p class="empty">{t('pptx.chart.userShapesEmpty')}</p>
	{:else}
		{#each rows as row (row.path.join(','))}
			<div
				class="row-container"
				style="margin-left: {row.depth * 12}px"
				data-chart-user-shape-path={row.path.join(',')}
			>
				<div class="row">
					<span class="name">{kindLabel(row.kind)}{row.text ? ` - ${row.text}` : ''}</span>
					{#if row.isGroup}
						<button type="button" disabled={!canEdit} onclick={() => addIntoGroup(row.path)}>
							{t('pptx.chart.userShapeAddIntoGroup')}
						</button>
					{/if}
					<button
						type="button"
						disabled={!canEdit}
						aria-label={t('pptx.chart.userShapeDelete')}
						onclick={() => removeRow(row.path)}
					>
						&#10005;
					</button>
				</div>

				{#if row.editableVisuals}
					<div class="anchor">
						<span>{t('pptx.chart.userShapeText')}</span>
						<input
							type="text"
							aria-label={t('pptx.chart.userShapeText')}
							disabled={!canEdit}
							value={row.text ?? ''}
							onchange={(event) => updateText(row.path, event.currentTarget.value)}
						/>
					</div>
					<div class="anchor">
						<span>{t('pptx.chart.userShapeFill')}</span>
						<input
							type="color"
							aria-label={t('pptx.chart.userShapeFill')}
							disabled={!canEdit}
							value={row.fill ?? '#ffffff'}
							onchange={(event) => updateRow(row.path, { fill: event.currentTarget.value })}
						/>
						<span>{t('pptx.chart.userShapeStroke')}</span>
						<input
							type="color"
							aria-label={t('pptx.chart.userShapeStroke')}
							disabled={!canEdit}
							value={row.stroke ?? '#000000'}
							onchange={(event) => updateRow(row.path, { stroke: event.currentTarget.value })}
						/>
					</div>
				{/if}

				{#if row.editableAltText}
					<div class="anchor">
						<span>{t('pptx.chart.userShapeAltText')}</span>
						<input
							type="text"
							aria-label={t('pptx.chart.userShapeAltText')}
							disabled={!canEdit}
							value={row.altText ?? ''}
							onchange={(event) => updateRow(row.path, { altText: event.currentTarget.value })}
						/>
					</div>
				{/if}

				<!-- Every row (including a grpSp group header) is position/size
				editable: a top-level group's own drawing anchor moves/resizes it,
				and a nested row edits a chart-relative from/to fraction. -->
				<ChartUserShapePositionFields
					{row}
					userShapes={data.userShapes}
					{canEdit}
					onpatch={updateRow}
					onboxpatch={updateBox}
					onrotationpatch={updateRotation}
					onflippatch={updateFlip}
				/>
			</div>
		{/each}
	{/if}
</div>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h5 {
		margin: 6px 0 0;
		font-size: 10px;
		text-transform: uppercase;
	}
	.empty {
		color: var(--pptx-muted-foreground);
		font-size: 10px;
		font-style: italic;
	}
	.row-container {
		margin-top: 5px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 5px;
	}
	.name {
		overflow: hidden;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.anchor {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		margin: 3px 0 5px;
	}
	.anchor input[type='text'] {
		width: 0;
		flex: 1;
		min-width: 0;
		height: 22px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-background);
		color: inherit;
	}
</style>
