<script lang="ts">
	/**
	 * ChartTrendlineSection: per-series trendlines, mirroring React's
	 * `inspector/ChartTrendlineOptions.tsx`.
	 *
	 * Supersedes the bare "No trendline / linear / ..." select that used to sit in
	 * the series fieldset of `ChartSection`. That control had three problems this
	 * one fixes: its options were hard-coded English rather than the shared
	 * `TRENDLINE_TYPE_OPTIONS` catalogue, it was offered on chart types where
	 * PowerPoint discards a trendline (pie, doughnut, treemap, ...), and picking a
	 * type rebuilt the trendline from scratch, so it silently dropped the order /
	 * period / forecast fields a loaded deck already carried.
	 *
	 * The `displayEq` / `displayRSq` toggles are the sub-options Svelte was
	 * missing outright: both are honoured by the shared trendline renderer
	 * (`chart-trendlines.ts`), which draws the fitted equation and R-squared
	 * label next to the line, so they repaint immediately.
	 */
	import type { PptxChartData, PptxChartTrendline } from 'pptx-viewer-core';
	import { TRENDLINE_SUPPORTED_TYPES, TRENDLINE_TYPE_OPTIONS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		data,
		canEdit,
		onsettrendline,
	}: {
		data: PptxChartData;
		canEdit: boolean;
		onsettrendline: (seriesIndex: number, trendline: PptxChartTrendline | null) => void;
	} = $props();
	const t = useTranslator();

	const supported = $derived(
		TRENDLINE_SUPPORTED_TYPES.has(data.chartType) && data.series.length > 0,
	);

	/**
	 * Spread the existing trendline so switching regression type keeps whatever
	 * else the deck set (polynomial order, moving-average period, forecasts).
	 */
	function chooseType(index: number, existing: PptxChartTrendline | undefined, value: string): void {
		if (!value) {
			onsettrendline(index, null);
			return;
		}
		onsettrendline(index, {
			...existing,
			trendlineType: value as PptxChartTrendline['trendlineType'],
		});
	}
</script>

{#if supported}
	<div class="pptx-svelte-chart-trendlines">
		<h5>{t('pptx.chart.trendlines')}</h5>
		{#each data.series as series, index (index)}
			{@const trendline = series.trendlines?.[0]}
			<div class="row">
				<span class="name" title={series.name}>{series.name}</span>
				<select
					disabled={!canEdit}
					aria-label={`${t('pptx.chart.trendlines')}: ${series.name}`}
					value={trendline?.trendlineType ?? ''}
					onchange={(event) => chooseType(index, trendline, event.currentTarget.value)}
				>
					{#each TRENDLINE_TYPE_OPTIONS as option (option.value)}
						<option value={option.value}>{t(option.labelKey)}</option>
					{/each}
				</select>
			</div>
			{#if trendline}
				<div class="subs">
					<label>
						<input
							type="checkbox"
							disabled={!canEdit}
							checked={trendline.displayEq ?? false}
							onchange={(event) =>
								onsettrendline(index, { ...trendline, displayEq: event.currentTarget.checked })}
						/>
						{t('pptx.chart.trendlineEquation')}
					</label>
					<label>
						<input
							type="checkbox"
							disabled={!canEdit}
							checked={trendline.displayRSq ?? false}
							onchange={(event) =>
								onsettrendline(index, { ...trendline, displayRSq: event.currentTarget.checked })}
						/>
						{t('pptx.chart.trendlineRSquared')}
					</label>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	h5 {
		margin: 6px 0 0;
		font-size: 10px;
		text-transform: uppercase;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
		align-items: center;
		margin-top: 5px;
	}
	.name {
		overflow: hidden;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.subs {
		display: flex;
		gap: 10px;
		margin: 4px 0 0 6px;
	}
	.subs label {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
	}
	select {
		min-width: 0;
		height: 25px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-background);
		color: inherit;
	}
</style>
