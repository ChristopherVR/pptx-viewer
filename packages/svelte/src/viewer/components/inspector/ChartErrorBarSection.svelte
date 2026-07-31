<script lang="ts">
	/**
	 * ChartErrorBarSection: per-series error bars, mirroring React's
	 * `inspector/ChartErrorBarOptions.tsx` (and matching vanilla's
	 * `chart-exhaustive-controls.ts`).
	 *
	 * Supersedes the hard-coded, untranslated error-bar rows that used to sit
	 * inside `ChartAdvancedSection`: the option lists, the chart types where
	 * error bars are meaningful, and the rule that `stdErr` takes no amount all
	 * come from `pptx-viewer-shared`'s `chart-editor-options`, so the control
	 * cannot drift from the other bindings and is fully translated.
	 *
	 * The whole section hides on chart types that cannot carry error bars
	 * (pie, doughnut, radar, ...) rather than offering a setting PowerPoint
	 * would discard.
	 */
	import type { PptxChartData, PptxChartErrBars } from 'pptx-viewer-core';
	import {
		ERROR_BAR_SUPPORTED_TYPES,
		ERROR_BAR_TYPE_OPTIONS,
		ERROR_BAR_VALTYPE_OPTIONS,
		ERROR_BAR_VALUE_TYPES,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		data,
		canEdit,
		onseterrorbars,
	}: {
		data: PptxChartData;
		canEdit: boolean;
		onseterrorbars: (seriesIndex: number, errBars: PptxChartErrBars | null) => void;
	} = $props();
	const t = useTranslator();

	const supported = $derived(
		ERROR_BAR_SUPPORTED_TYPES.has(data.chartType) && data.series.length > 0,
	);

	/** Turn a selected value type into a complete error-bar record (or clear it). */
	function chooseValType(
		seriesIndex: number,
		bars: PptxChartErrBars | undefined,
		valType: string,
	): void {
		if (!valType) {
			onseterrorbars(seriesIndex, null);
			return;
		}
		onseterrorbars(seriesIndex, {
			direction: bars?.direction ?? 'y',
			barType: bars?.barType ?? 'both',
			valType: valType as PptxChartErrBars['valType'],
			val: bars?.val,
		});
	}
</script>

{#if supported}
	<div class="pptx-svelte-chart-errbars">
		<span class="pptx-svelte-chart-errbars-title">{t('pptx.chart.errorBars')}</span>
		{#each data.series as series, seriesIndex (seriesIndex)}
			{@const bars = series.errBars?.[0]}
			<div class="pptx-svelte-chart-errbars-row">
				<span class="pptx-svelte-chart-errbars-name" title={series.name}>{series.name}</span>
				<select
					disabled={!canEdit}
					aria-label={`${t('pptx.chart.errorBars')}: ${series.name}`}
					value={bars?.valType ?? ''}
					onchange={(event) => chooseValType(seriesIndex, bars, event.currentTarget.value)}
				>
					{#each ERROR_BAR_VALTYPE_OPTIONS as option (option.value)}
						<option value={option.value}>{t(option.labelKey)}</option>
					{/each}
				</select>
			</div>
			{#if bars}
				<div class="pptx-svelte-chart-errbars-detail">
					<select
						disabled={!canEdit}
						aria-label={`${t('pptx.chart.errorBarBoth')}: ${series.name}`}
						value={bars.barType}
						onchange={(event) =>
							onseterrorbars(seriesIndex, {
								...bars,
								barType: event.currentTarget.value as PptxChartErrBars['barType'],
							})}
					>
						{#each ERROR_BAR_TYPE_OPTIONS as option (option.value)}
							<option value={option.value}>{t(option.labelKey)}</option>
						{/each}
					</select>
					{#if ERROR_BAR_VALUE_TYPES.has(bars.valType ?? '')}
						<input
							type="number"
							disabled={!canEdit}
							aria-label={`${t('pptx.chart.errorBarAmount')}: ${series.name}`}
							placeholder={t('pptx.chart.errorBarAmount')}
							value={bars.val ?? ''}
							onchange={(event) => {
								const raw = event.currentTarget.value;
								const value = raw === '' ? undefined : Number.parseFloat(raw);
								if (raw === '' || Number.isFinite(value)) {
									onseterrorbars(seriesIndex, { ...bars, val: value });
								}
							}}
						/>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-chart-errbars {
		display: grid;
		gap: 5px;
		margin-top: 8px;
		padding-top: 7px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-chart-errbars-title {
		font-weight: 600;
	}

	.pptx-svelte-chart-errbars-row {
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		gap: 6px;
		align-items: center;
	}

	.pptx-svelte-chart-errbars-name {
		overflow: hidden;
		color: var(--pptx-muted-foreground, #94a3b8);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-chart-errbars-detail {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
		margin-left: 8px;
	}

	select,
	input {
		min-width: 0;
		height: 25px;
		box-sizing: border-box;
		padding: 0 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}
</style>
