<script lang="ts">
	/**
	 * ChartUserShapeSection: "Chart overlay shapes" section (`c:userShapes`
	 * drawing overlay, C2-G10 edit/serialize follow-up), mirroring React's
	 * `inspector/ChartUserShapeOptions.tsx`.
	 *
	 * List existing overlay shapes, add a default text box, delete one, and
	 * nudge a `sp`/`cxnSp` shape's anchor fractions. Pure view over
	 * `pptx-viewer-shared`'s `chart-user-shape-edit` helpers.
	 */
	import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
	import {
		createDefaultChartUserShape,
		listChartUserShapeDescriptors,
		withChartUserShapeAdded,
		withChartUserShapeRemoved,
		withChartUserShapeUpdated,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

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

	const descriptors = $derived(listChartUserShapeDescriptors(data.userShapes));

	function kindLabel(kind: string): string {
		return t(`pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);
	}

	function addTextBox(): void {
		onpatch({ userShapes: withChartUserShapeAdded(data.userShapes, createDefaultChartUserShape()) });
	}

	function removeShape(index: number): void {
		onpatch({ userShapes: withChartUserShapeRemoved(data.userShapes, index) });
	}

	function updateAnchor(index: number, patch: Partial<PptxChartUserShape>): void {
		onpatch({ userShapes: withChartUserShapeUpdated(data.userShapes, index, patch) });
	}
</script>

<div class="pptx-svelte-chart-usershapes">
	<div class="header">
		<h5>{t('pptx.chart.userShapes')}</h5>
		<button type="button" disabled={!canEdit} onclick={addTextBox}>
			{t('pptx.chart.userShapeAddTextBox')}
		</button>
	</div>
	{#if descriptors.length === 0}
		<p class="empty">{t('pptx.chart.userShapesEmpty')}</p>
	{:else}
		{#each descriptors as d (d.index)}
			<div class="row">
				<span class="name">{kindLabel(d.kind)}{d.text ? ` - ${d.text}` : ''}</span>
				<button
					type="button"
					disabled={!canEdit}
					aria-label={t('pptx.chart.userShapeDelete')}
					onclick={() => removeShape(d.index)}
				>
					&#10005;
				</button>
			</div>
			{#if d.editable}
				<div class="anchor">
					<span>{t('pptx.chart.userShapeFrom')}</span>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						disabled={!canEdit}
						value={d.from.x}
						onchange={(event) =>
							updateAnchor(d.index, { from: { ...d.from, x: Number(event.currentTarget.value) } })}
					/>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						disabled={!canEdit}
						value={d.from.y}
						onchange={(event) =>
							updateAnchor(d.index, { from: { ...d.from, y: Number(event.currentTarget.value) } })}
					/>
					{#if d.anchor === 'rel' && d.to}
						<span>{t('pptx.chart.userShapeTo')}</span>
						<input
							type="number"
							step="0.01"
							min="0"
							max="1"
							disabled={!canEdit}
							value={d.to.x}
							onchange={(event) =>
								updateAnchor(d.index, { to: { ...d.to!, x: Number(event.currentTarget.value) } })}
						/>
						<input
							type="number"
							step="0.01"
							min="0"
							max="1"
							disabled={!canEdit}
							value={d.to.y}
							onchange={(event) =>
								updateAnchor(d.index, { to: { ...d.to!, y: Number(event.currentTarget.value) } })}
						/>
					{/if}
				</div>
			{:else}
				<p class="not-editable">{t('pptx.chart.userShapeNotEditable')}</p>
			{/if}
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
	.empty,
	.not-editable {
		color: var(--pptx-muted-foreground);
		font-size: 10px;
		font-style: italic;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 5px;
		margin-top: 5px;
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
	.anchor input {
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
