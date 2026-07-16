<script lang="ts">
	import type { PptxChartAxisFormatting, PptxChartData, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';

	import type { EditorState } from '../../editor/editor-state.svelte';
	import ChartAdvancedSection from './ChartAdvancedSection.svelte';
	import ChartLabelsAxesSection from './ChartLabelsAxesSection.svelte';

	const { editor }: { editor: EditorState } = $props();
	const chart = $derived(editor.selectedElement?.type === 'chart' ? editor.selectedElement : undefined);
	const data = $derived(chart?.chartData);

	function patch(next: Partial<PptxChartData>): void {
		if (chart && data) {
			editor.applyElementPatch(chart.id, { chartData: { ...data, ...next } });
		}
	}
	function seriesPatch(index: number, next: Partial<PptxChartSeries>): void {
		if (data) {
			patch({ series: data.series.map((series, i) => i === index ? { ...series, ...next } : series) });
		}
	}
	function axisPatch(index: number, next: Partial<PptxChartAxisFormatting>): void {
		if (data) {
			patch({ axes: (data.axes ?? []).map((axis, i) => i === index ? { ...axis, ...next } : axis) });
		}
	}
</script>

{#if data}<div class="section">
	<label>Chart type<select value={data.chartType} onchange={(event) => patch({ chartType: event.currentTarget.value as PptxChartType })}>{#each ['bar','line','pie','doughnut','area','scatter','bubble','radar','waterfall','funnel','treemap','sunburst','combo'] as type}<option value={type}>{type}</option>{/each}</select></label>
	<label>Title<input value={data.title ?? ''} oninput={(event) => patch({ title: event.currentTarget.value, style: { ...data.style, hasTitle: Boolean(event.currentTarget.value) } })} /></label>
	<div class="checks"><label><input type="checkbox" checked={data.style?.hasLegend ?? false} onchange={(event) => patch({ style: { ...data.style, hasLegend: event.currentTarget.checked } })} />Legend</label><label><input type="checkbox" checked={data.style?.hasDataLabels ?? false} onchange={(event) => patch({ style: { ...data.style, hasDataLabels: event.currentTarget.checked } })} />Data labels</label><label><input type="checkbox" checked={data.style?.hasGridlines ?? false} onchange={(event) => patch({ style: { ...data.style, hasGridlines: event.currentTarget.checked } })} />Gridlines</label></div>
	<h5>Series</h5>{#each data.series as series, index}<fieldset><input aria-label="Series name" value={series.name} oninput={(event) => seriesPatch(index, { name: event.currentTarget.value })} /><input aria-label="Series values" value={series.values.join(', ')} onchange={(event) => seriesPatch(index, { values: event.currentTarget.value.split(',').map(Number).filter(Number.isFinite) })} /><input type="color" aria-label="Series color" value={series.color ?? '#4472c4'} onchange={(event) => seriesPatch(index, { color: event.currentTarget.value })} /><select aria-label="Trendline" value={series.trendlines?.[0]?.trendlineType ?? ''} onchange={(event) => seriesPatch(index, { trendlines: (event.currentTarget.value ? [{ trendlineType: event.currentTarget.value }] : []) as PptxChartSeries['trendlines'] })}><option value="">No trendline</option>{#each ['linear','exponential','logarithmic','polynomial','power','movingAvg'] as type}<option value={type}>{type}</option>{/each}</select></fieldset>{/each}
	<h5>Axes</h5>{#each data.axes ?? [] as axis, index}<fieldset><input aria-label="Axis title" value={axis.titleText ?? ''} oninput={(event) => axisPatch(index, { titleText: event.currentTarget.value })} /><input type="number" aria-label="Axis minimum" placeholder="Min" value={axis.min ?? ''} onchange={(event) => axisPatch(index, { min: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} /><input type="number" aria-label="Axis maximum" placeholder="Max" value={axis.max ?? ''} onchange={(event) => axisPatch(index, { max: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} /></fieldset>{/each}
	<ChartLabelsAxesSection {data} onpatch={patch} />
	<ChartAdvancedSection {data} onpatch={patch} />
</div>{/if}

<style>.section{display:grid;gap:8px}label{display:grid;gap:3px;color:var(--pptx-muted-foreground);font-size:10px}input,select{min-width:0;height:26px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}.checks{display:grid;grid-template-columns:1fr 1fr;gap:5px}.checks label{display:flex;align-items:center}h5{margin:6px 0 0;font-size:10px;text-transform:uppercase}fieldset{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0;padding:7px;border:1px solid var(--pptx-border);border-radius:6px}</style>
