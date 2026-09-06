<script lang="ts">
	/**
	 * ChartFilteredSeriesOptions: PowerPoint's "Chart Filters" series show/hide,
	 * plus a per-series editor for the cached label strings behind "Value From
	 * Cells" (`c15:datalabelsRange`/`c15:dlblRangeCache`), when a series carries
	 * one. Mirrors React's `inspector/ChartFilteredSeriesOptions.tsx`.
	 *
	 * Both are read-mostly extensions core previously only round-tripped; see
	 * `pptx-viewer-shared`'s `chart-ext-editor-actions.ts` for the pure
	 * transforms this panel wraps.
	 */
	import type { PptxChartData } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';

	const {
		chartData,
		canEdit,
		onhideseries,
		onrestoreseries,
		onsetdatalabelsrangecache,
	}: {
		chartData: PptxChartData;
		canEdit: boolean;
		onhideseries: (seriesIndex: number) => void;
		onrestoreseries: (filteredIndex: number) => void;
		onsetdatalabelsrangecache: (seriesIndex: number, pointIndex: number, text: string) => void;
	} = $props();
	const t = useTranslator();

	const filteredSeries = $derived(chartData.filteredSeries ?? []);
	const seriesWithRange = $derived(
		chartData.series
			.map((series, index) => ({ series, index }))
			.filter(({ series }) => series.dataLabelOptions?.dataLabelsRange),
	);
	const visible = $derived(
		filteredSeries.length > 0 || seriesWithRange.length > 0 || chartData.series.length > 1,
	);
</script>

{#if visible}
	<div class="pptx-svelte-chart-filters">
		<h5>{t('pptx.chart.chartFilters')}</h5>
		{#if chartData.series.length > 1}
			<div class="rows">
				{#each chartData.series as series, index (index)}
					<div class="row">
						<span class="name" title={series.name}>{series.name}</span>
						<button
							type="button"
							disabled={!canEdit}
							aria-label={t('pptx.chart.hideSeries', { name: series.name })}
							data-testid={`chart-series-hide-${index}`}
							onclick={() => onhideseries(index)}
						>
							&minus;
						</button>
					</div>
				{/each}
			</div>
		{/if}
		{#if filteredSeries.length > 0}
			<div class="rows">
				{#each filteredSeries as filtered, index (index)}
					{@const name = filtered.name ?? chartData.filteredSeriesTitle ?? t('pptx.chart.seriesShort')}
					<div class="row filtered">
						<span class="name" title={name}>{name}</span>
						<button
							type="button"
							disabled={!canEdit}
							aria-label={t('pptx.chart.showSeries', { name })}
							data-testid={`chart-series-show-${index}`}
							onclick={() => onrestoreseries(index)}
						>
							+
						</button>
					</div>
				{/each}
			</div>
		{/if}
		{#each seriesWithRange as { series, index: seriesIndex } (seriesIndex)}
			<div class="range">
				<div class="range-title" title={series.name}>
					{t('pptx.chart.valueFromCells', { name: series.name })}
				</div>
				{#each series.dataLabelOptions?.dataLabelsRange?.cache ?? [] as text, pointIndex (pointIndex)}
					<label class="range-row">
						<span class="range-label">{chartData.categories[pointIndex] ?? pointIndex}</span>
						<input
							type="text"
							disabled={!canEdit}
							value={text}
							data-testid={`chart-dlbl-range-${seriesIndex}-${pointIndex}`}
							onchange={(event) =>
								onsetdatalabelsrangecache(seriesIndex, pointIndex, event.currentTarget.value)}
						/>
					</label>
				{/each}
			</div>
		{/each}
	</div>
{/if}

<style>
	h5 {
		margin: 6px 0 0;
		font-size: 10px;
		text-transform: uppercase;
	}
	.rows {
		display: grid;
		gap: 4px;
		margin-top: 5px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}
	.row.filtered {
		opacity: 0.6;
	}
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row button {
		flex: none;
		width: 22px;
		height: 22px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
	}
	.range {
		display: grid;
		gap: 4px;
		margin-top: 6px;
	}
	.range-title {
		overflow: hidden;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.range-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}
	.range-label {
		flex: none;
		width: 64px;
		overflow: hidden;
		color: var(--pptx-muted-foreground);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.range-row input {
		flex: 1;
		min-width: 0;
		height: 22px;
		border: 1px solid var(--pptx-border);
		border-radius: 4px;
		background: var(--pptx-background);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}
</style>
