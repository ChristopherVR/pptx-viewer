<script lang="ts">
	/**
	 * ChartPointMarkerSection: per-data-point marker overrides, mirroring React's
	 * `inspector/ChartDataPointMarkerOptions.tsx`.
	 *
	 * A `c:dPt` may carry its own `c:marker`, which replaces the series marker for
	 * that point alone: the usual reason is calling out one outlier on an
	 * otherwise uniform line. Svelte could set a SERIES marker (in
	 * `ChartAdvancedSection`) but had no way to reach a single point.
	 *
	 * Edits route through core's `setChartDataPointMarker`, the same operation
	 * React and Vue use, so the `c:dPt` bookkeeping (creating the override,
	 * dropping an emptied one) cannot drift between bindings.
	 */
	import type { ChartPptxElement, PptxChartMarkerSymbol } from 'pptx-viewer-core';
	import { MARKER_SUPPORTED_TYPES, MARKER_SYMBOL_OPTIONS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	/** Patch accepted by core's `setChartDataPointMarker`. */
	interface PointMarkerEdit {
		symbol?: PptxChartMarkerSymbol;
		size?: number;
		fillColor?: string;
	}

	const {
		element,
		canEdit,
		onsetpointmarker,
	}: {
		element: ChartPptxElement;
		canEdit: boolean;
		onsetpointmarker: (
			seriesIndex: number,
			pointIndex: number,
			marker: PointMarkerEdit | null,
		) => void;
	} = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let chosen = $state(0);

	const series = $derived(element.chartData?.series ?? []);
	const categories = $derived(element.chartData?.categories ?? []);
	const supported = $derived(
		element.chartData !== undefined &&
			MARKER_SUPPORTED_TYPES.has(element.chartData.chartType) &&
			series.length > 0 &&
			categories.length > 0,
	);
	/** Clamp the picker: removing a series must not strand the index past the end. */
	const active = $derived(Math.min(chosen, Math.max(0, series.length - 1)));
	// Concrete symbols only; the '' sentinel means "series default", which is
	// what clearing the override already expresses.
	const symbols = MARKER_SYMBOL_OPTIONS.filter((option) => option.value !== '');

	function markerAt(pointIndex: number) {
		return series[active]?.dataPoints?.find((point) => point.idx === pointIndex)?.marker;
	}
</script>

{#if supported}
	<div class="pptx-svelte-chart-point-markers">
		<h5>{t('pptx.chart.pointMarkers')}</h5>

		{#if series.length > 1}
			<label class="picker">
				{t('pptx.chart.series')}
				<select disabled={!canEdit} bind:value={chosen}>
					{#each series as item, index (index)}
						<option value={index}>{item.name}</option>
					{/each}
				</select>
			</label>
		{/if}

		{#each categories as category, index (index)}
			{@const marker = markerAt(index)}
			<div class="row">
				<span class="name" title={category}>{category}</span>
				<label class="toggle">
					<input
						type="checkbox"
						disabled={!canEdit}
						checked={marker !== undefined}
						onchange={(event) =>
							onsetpointmarker(
								active,
								index,
								event.currentTarget.checked ? { symbol: 'circle' } : null,
							)}
					/>
					{t('pptx.chart.markerOverride')}
				</label>
			</div>
			{#if marker}
				<div class="overrides">
					<select
						disabled={!canEdit}
						value={marker.symbol}
						onchange={(event) =>
							onsetpointmarker(active, index, {
								symbol: event.currentTarget.value as PptxChartMarkerSymbol,
							})}
					>
						{#each symbols as option (option.value)}
							<option value={option.value}>{t(option.labelKey)}</option>
						{/each}
					</select>
					<input
						type="number"
						min="1"
						max="20"
						disabled={!canEdit}
						title={t('pptx.chart.markerSize')}
						placeholder={t('pptx.chart.auto')}
						value={marker.size ?? ''}
						onchange={(event) => {
							const num = Number.parseInt(event.currentTarget.value, 10);
							onsetpointmarker(active, index, {
								size: Number.isFinite(num) ? num : undefined,
							});
						}}
					/>
					<input
						type="color"
						disabled={!canEdit}
						title={t('pptx.chart.markerFill')}
						value={marker.spPr?.fillColor ?? '#4472c4'}
						onchange={(event) =>
							onsetpointmarker(active, index, { fillColor: event.currentTarget.value })}
					/>
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
	.picker {
		display: grid;
		gap: 3px;
		margin-top: 5px;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto;
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
	.toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
	}
	.overrides {
		display: grid;
		grid-template-columns: 1fr 56px 34px;
		gap: 4px;
		margin: 4px 0 0 6px;
	}
	input,
	select {
		min-width: 0;
		height: 25px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-background);
		color: inherit;
	}
</style>
