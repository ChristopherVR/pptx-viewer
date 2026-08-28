<script lang="ts">
	/**
	 * ChartDataGrid: the spreadsheet-style category x series editor, mirroring
	 * React's `inspector/ChartDataGrid.tsx`.
	 *
	 * WHY this exists: before it, Svelte could only edit a series' values as a
	 * comma-joined string, which is unusable for anything past a toy chart and
	 * loses a value silently on a typo. This is the surface that makes chart
	 * data genuinely editable.
	 *
	 * Every mutation goes through `pptx-viewer-shared`'s `chart-data-grid-ops`,
	 * which owns the guards (auto-naming, never delete the last row/column,
	 * refuse a non-numeric cell instead of writing zero) so this component is
	 * pure presentation. Value inputs carry a `"<series> value <n>"` accessible
	 * name matching React's, so one e2e spec drives both.
	 */
	import type { PptxChartData } from 'pptx-viewer-core';
	import {
		addChartCategory,
		addChartSeries,
		removeChartCategory,
		removeChartSeries,
		setChartCategoryLabel,
		setChartCellValue,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import { useViewerOptions } from '../../state/viewer-options-context';

	const optionsState = useViewerOptions();
	// File > Options > Advanced > "Properties follow chart data point for
	// current workbook": whether per-point manual formatting re-indexes with
	// the underlying data (default) or stays pinned to its old position.
	const followDataPoint = $derived(optionsState.options.advanced.chartPropertiesFollowDataPoint);

	const {
		data,
		canEdit,
		onreplace,
		onrenameseries,
	}: {
		data: PptxChartData;
		canEdit: boolean;
		onreplace: (next: PptxChartData) => void;
		onrenameseries: (seriesIndex: number, name: string) => void;
	} = $props();
	const t = useTranslator();

	/** Apply an op result, ignoring the `null` "refused" outcome. */
	function apply(next: PptxChartData | null): void {
		if (next) {
			onreplace(next);
		}
	}
</script>

<div class="pptx-svelte-chart-grid">
	<div class="pptx-svelte-chart-grid-head">
		<span class="pptx-svelte-chart-grid-title">{t('pptx.chart.data')}</span>
		{#if canEdit}
			<div class="pptx-svelte-chart-grid-actions">
				<button
					type="button"
					title={t('pptx.chart.addCategory')}
					aria-label={t('pptx.chart.addCategory')}
					onclick={() => apply(addChartCategory(data))}
				>
					+ {t('pptx.chart.cat')}
				</button>
				<button
					type="button"
					title={t('pptx.chart.addSeries')}
					aria-label={t('pptx.chart.addSeries')}
					onclick={() => apply(addChartSeries(data))}
				>
					+ {t('pptx.chart.seriesShort')}
				</button>
			</div>
		{/if}
	</div>

	<div class="pptx-svelte-chart-grid-scroll">
		<table>
			<thead>
				<tr>
					<th aria-label={t('pptx.chart.categories')}></th>
					{#each data.series as series, seriesIndex (seriesIndex)}
						<th>
							<div class="pptx-svelte-chart-grid-cell">
								<input
									type="text"
									disabled={!canEdit}
									aria-label={`${t('pptx.chart.seriesShort')} ${seriesIndex + 1}`}
									value={series.name}
									onchange={(event) => onrenameseries(seriesIndex, event.currentTarget.value)}
								/>
								{#if canEdit && data.series.length > 1}
									<button
										type="button"
										class="pptx-svelte-chart-grid-remove"
										title={t('pptx.chart.removeSeries')}
										aria-label={t('pptx.chart.removeSeries')}
										onclick={() => apply(removeChartSeries(data, seriesIndex))}
									>
										&times;
									</button>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.categories as category, categoryIndex (categoryIndex)}
					<tr>
						<td>
							<div class="pptx-svelte-chart-grid-cell">
								<input
									type="text"
									disabled={!canEdit}
									aria-label={`${t('pptx.chart.categories')} ${categoryIndex + 1}`}
									value={category}
									onchange={(event) =>
										apply(setChartCategoryLabel(data, categoryIndex, event.currentTarget.value))}
								/>
								{#if canEdit && data.categories.length > 1}
									<button
										type="button"
										class="pptx-svelte-chart-grid-remove"
										title={t('pptx.chart.removeCategory')}
										aria-label={t('pptx.chart.removeCategory')}
										onclick={() => apply(removeChartCategory(data, categoryIndex, followDataPoint))}
									>
										&times;
									</button>
								{/if}
							</div>
						</td>
						{#each data.series as series, seriesIndex (seriesIndex)}
							<td>
								<input
									type="number"
									disabled={!canEdit}
									aria-label={`${series.name} value ${categoryIndex + 1}`}
									value={series.values[categoryIndex] ?? 0}
									onchange={(event) =>
										apply(
											setChartCellValue(
												data,
												seriesIndex,
												categoryIndex,
												event.currentTarget.value,
											),
										)}
								/>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.pptx-svelte-chart-grid {
		display: grid;
		gap: 6px;
		margin-top: 8px;
		padding-top: 7px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-chart-grid-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-chart-grid-title {
		font-weight: 600;
	}

	.pptx-svelte-chart-grid-actions {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}

	.pptx-svelte-chart-grid-actions button {
		padding: 2px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 10px;
		cursor: pointer;
	}

	/* Wide grids scroll inside the card; the inspector must never scroll sideways. */
	.pptx-svelte-chart-grid-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
	}

	th,
	td {
		padding: 1px;
		font-weight: 400;
		text-align: left;
	}

	th {
		min-width: 76px;
	}

	.pptx-svelte-chart-grid-cell {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	input {
		width: 100%;
		min-width: 0;
		height: 22px;
		box-sizing: border-box;
		padding: 0 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-chart-grid-remove {
		flex: none;
		width: 16px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}

	.pptx-svelte-chart-grid-remove:hover {
		color: #f87171;
	}
</style>
