<script lang="ts">
	/**
	 * ChartSection: the chart inspector body, mirroring React's
	 * `inspector/ChartDataPanel.tsx` composition.
	 *
	 * Order matches React: type + title + display toggles, then the
	 * spreadsheet-style {@link ChartDataGrid}, then per-series styling, axes,
	 * {@link ChartErrorBarSection}, and the advanced disclosures.
	 *
	 * The old comma-joined "series values" text input is kept alongside the grid
	 * because it remains the fastest way to paste a whole row; the grid is what
	 * makes a single cell editable without retyping the rest.
	 */
	import type {
		ChartPptxElement,
		PptxChartAxisFormatting,
		PptxChartData,
		PptxChartErrBars,
		PptxChartMarkerSymbol,
		PptxChartSeries,
		PptxChartTrendline,
		PptxChartType,
	} from 'pptx-viewer-core';
	import { setChartDataPointMarker } from 'pptx-viewer-core';
	import { CHART_TYPE_LABEL_KEYS, schemaLabel } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import ChartAdvancedSection from './ChartAdvancedSection.svelte';
	import ChartAxisFormatSection from './ChartAxisFormatSection.svelte';
	import ChartDataGrid from './ChartDataGrid.svelte';
	import ChartErrorBarSection from './ChartErrorBarSection.svelte';
	import ChartLabelsAxesSection from './ChartLabelsAxesSection.svelte';
	import ChartPointMarkerSection from './ChartPointMarkerSection.svelte';
	import ChartTrendlineSection from './ChartTrendlineSection.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	/**
	 * The chart types this select offers, spelled out rather than derived from
	 * `CHART_TYPE_LABEL_KEYS` (which covers every type core can parse). Keeping
	 * the list explicit means translating the labels cannot silently add an
	 * option the panel never had, which would move it out of React parity.
	 */
	const chartTypes: readonly PptxChartType[] = [
		'bar',
		'line',
		'pie',
		'doughnut',
		'area',
		'scatter',
		'bubble',
		'radar',
		'waterfall',
		'funnel',
		'treemap',
		'sunburst',
		'combo',
	];
	const chart = $derived(
		editor.selectedElement?.type === 'chart' ? editor.selectedElement : undefined,
	);
	const data = $derived(chart?.chartData);
	const canEdit = $derived(editor.editable);

	function patch(next: Partial<PptxChartData>): void {
		if (chart && data) {
			editor.applyElementPatch(chart.id, { chartData: { ...data, ...next } });
		}
	}
	/** Replace the whole chart-data object (used by the grid's structural edits). */
	function replace(next: PptxChartData): void {
		if (chart) {
			editor.applyElementPatch(chart.id, { chartData: next });
		}
	}
	function seriesPatch(index: number, next: Partial<PptxChartSeries>): void {
		if (data) {
			patch({ series: data.series.map((series, i) => (i === index ? { ...series, ...next } : series)) });
		}
	}
	function axisPatch(index: number, next: Partial<PptxChartAxisFormatting>): void {
		if (data) {
			patch({ axes: (data.axes ?? []).map((axis, i) => (i === index ? { ...axis, ...next } : axis)) });
		}
	}
	/** Set or clear one series' error bars (core stores them as a 1-item array). */
	function setErrorBars(index: number, errBars: PptxChartErrBars | null): void {
		seriesPatch(index, { errBars: errBars ? [errBars] : undefined });
	}
	/**
	 * Set or clear one series' trendline. Clearing writes an EMPTY array, not
	 * `undefined`: the save serializer treats `undefined` as "not modelled, leave
	 * the XML alone", so a removed trendline would come straight back on reload.
	 */
	function setTrendline(index: number, trendline: PptxChartTrendline | null): void {
		seriesPatch(index, { trendlines: trendline ? [trendline] : [] });
	}
	/**
	 * Set or clear a per-point marker override through core's headless op, which
	 * mutates in place: run it over a deep clone so the editor sees a fresh
	 * reference (Svelte's `$state` proxies compare by identity) and undo stays a
	 * single, self-contained step.
	 */
	function setPointMarker(
		seriesIndex: number,
		pointIndex: number,
		marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
	): void {
		if (!chart || !data) {
			return;
		}
		const clone: ChartPptxElement = { ...chart, chartData: structuredClone($state.snapshot(data)) };
		setChartDataPointMarker(clone, seriesIndex, pointIndex, marker);
		replace(clone.chartData!);
	}
</script>

{#if data}<div class="section">
	<label>Chart type<select value={data.chartType} onchange={(event) => patch({ chartType: event.currentTarget.value as PptxChartType })}>{#each chartTypes as type}<option value={type}>{schemaLabel(CHART_TYPE_LABEL_KEYS, type, t)}</option>{/each}</select></label>
	<label>Title<input value={data.title ?? ''} oninput={(event) => patch({ title: event.currentTarget.value, style: { ...data.style, hasTitle: Boolean(event.currentTarget.value) } })} /></label>
	<div class="checks"><label><input type="checkbox" checked={data.style?.hasLegend ?? false} onchange={(event) => patch({ style: { ...data.style, hasLegend: event.currentTarget.checked } })} />Legend</label><label><input type="checkbox" checked={data.style?.hasDataLabels ?? false} onchange={(event) => patch({ style: { ...data.style, hasDataLabels: event.currentTarget.checked } })} />Data labels</label><label><input type="checkbox" checked={data.style?.hasGridlines ?? false} onchange={(event) => patch({ style: { ...data.style, hasGridlines: event.currentTarget.checked } })} />Gridlines</label></div>
	<ChartDataGrid
		{data}
		{canEdit}
		onreplace={replace}
		onrenameseries={(index, name) => seriesPatch(index, { name })}
	/>
	<h5>Series</h5>{#each data.series as series, index}<fieldset><input aria-label="Series name" value={series.name} oninput={(event) => seriesPatch(index, { name: event.currentTarget.value })} /><input aria-label="Series values" value={series.values.join(', ')} onchange={(event) => seriesPatch(index, { values: event.currentTarget.value.split(',').map(Number).filter(Number.isFinite) })} /><input type="color" aria-label="Series color" value={series.color ?? '#4472c4'} onchange={(event) => seriesPatch(index, { color: event.currentTarget.value })} /></fieldset>{/each}
	<ChartTrendlineSection {data} {canEdit} onsettrendline={setTrendline} />
	{#if chart}<ChartPointMarkerSection element={chart} {canEdit} onsetpointmarker={setPointMarker} />{/if}
	<h5>Axes</h5>{#each data.axes ?? [] as axis, index}<fieldset><input aria-label="Axis title" value={axis.titleText ?? ''} oninput={(event) => axisPatch(index, { titleText: event.currentTarget.value })} /><input type="number" aria-label="Axis minimum" placeholder="Min" value={axis.min ?? ''} onchange={(event) => axisPatch(index, { min: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} /><input type="number" aria-label="Axis maximum" placeholder="Max" value={axis.max ?? ''} onchange={(event) => axisPatch(index, { max: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} /></fieldset>{/each}
	<ChartErrorBarSection {data} {canEdit} onseterrorbars={setErrorBars} />
	<ChartAxisFormatSection {data} {canEdit} onpatch={patch} />
	<ChartLabelsAxesSection {data} onpatch={patch} />
	<ChartAdvancedSection {data} onpatch={patch} />
</div>{/if}

<style>.section{display:grid;gap:8px}label{display:grid;gap:3px;color:var(--pptx-muted-foreground);font-size:10px}input,select{min-width:0;height:26px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}.checks{display:grid;grid-template-columns:1fr 1fr;gap:5px}.checks label{display:flex;align-items:center}h5{margin:6px 0 0;font-size:10px;text-transform:uppercase}fieldset{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0;padding:7px;border:1px solid var(--pptx-border);border-radius:6px}</style>
