<script lang="ts">
	import type { PptxChartData, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';

	const { data, onpatch }: { data: PptxChartData; onpatch: (patch: Partial<PptxChartData>) => void } = $props();
	// eslint-disable-next-line prefer-const
	let pointSeries = $state(0);
	const activeSeries = $derived(data.series[Math.min(pointSeries, data.series.length - 1)]);

	function seriesPatch(index: number, next: Partial<PptxChartSeries>): void {
		onpatch({ series: data.series.map((series, i) => i === index ? { ...series, ...next } : series) });
	}

	function pointPatch(index: number, pointIndex: number, next: Record<string, unknown>): void {
		const series = data.series[index];
		const points = [...(series.dataPoints ?? [])];
		const existing = points.find((point) => point.idx === pointIndex);
		const patched = { idx: pointIndex, ...existing, ...next };
		seriesPatch(index, { dataPoints: existing ? points.map((point) => point.idx === pointIndex ? patched : point) : [...points, patched] });
	}

	function labelPatch(index: number, pointIndex: number, text: string): void {
		const series = data.series[index];
		const labels = [...(series.dataLabels ?? [])];
		const existing = labels.find((label) => label.idx === pointIndex);
		const next = text ? { idx: pointIndex, ...existing, text } : null;
		seriesPatch(index, { dataLabels: next ? (existing ? labels.map((label) => label.idx === pointIndex ? next : label) : [...labels, next]) : labels.filter((label) => label.idx !== pointIndex) });
	}
</script>

<details><summary>Series options</summary>
	{#each data.series as series, index}<fieldset><legend>{series.name}</legend>
		<label>Series chart type<select value={series.seriesChartType ?? ''} onchange={(event) => seriesPatch(index, { seriesChartType: (event.currentTarget.value || undefined) as PptxChartType | undefined })}><option value="">Chart default</option>{#each ['bar','line','area','scatter'] as type}<option value={type}>{type}</option>{/each}</select></label>
		<div class="grid"><label>Marker<select value={series.marker?.symbol ?? ''} onchange={(event) => seriesPatch(index, { marker: event.currentTarget.value ? { ...series.marker, symbol: event.currentTarget.value as NonNullable<PptxChartSeries['marker']>['symbol'] } : undefined })}><option value="">None</option>{#each ['auto','circle','diamond','square','star','triangle','plus','x','dash','dot'] as marker}<option value={marker}>{marker}</option>{/each}</select></label>{#if series.marker}<label>Marker size<input type="number" min="2" max="72" value={series.marker.size ?? 6} onchange={(event) => seriesPatch(index, { marker: { ...series.marker!, size: Number(event.currentTarget.value) } })} /></label><label>Marker fill<input type="color" value={series.marker.spPr?.fillColor ?? series.color ?? '#4472c4'} onchange={(event) => seriesPatch(index, { marker: { ...series.marker!, spPr: { ...series.marker!.spPr, fillColor: event.currentTarget.value } } })} /></label>{/if}</div>
		<label>Error bars<select value={series.errBars?.[0]?.valType ?? ''} onchange={(event) => seriesPatch(index, { errBars: event.currentTarget.value ? [{ direction: 'y', barType: series.errBars?.[0]?.barType ?? 'both', valType: event.currentTarget.value as NonNullable<PptxChartSeries['errBars']>[number]['valType'], val: series.errBars?.[0]?.val }] : undefined })}><option value="">None</option><option value="fixedVal">Fixed value</option><option value="percentage">Percentage</option><option value="stdDev">Standard deviation</option><option value="stdErr">Standard error</option></select></label>
		{#if series.errBars?.[0]}<div class="grid"><label>Direction<select value={series.errBars[0].barType} onchange={(event) => seriesPatch(index, { errBars: [{ ...series.errBars![0], barType: event.currentTarget.value as NonNullable<PptxChartSeries['errBars']>[number]['barType'] }] })}><option value="both">Both</option><option value="plus">Plus</option><option value="minus">Minus</option></select></label><label>Amount<input type="number" value={series.errBars[0].val ?? ''} onchange={(event) => seriesPatch(index, { errBars: [{ ...series.errBars![0], val: event.currentTarget.value ? Number(event.currentTarget.value) : undefined }] })} /></label></div>{/if}
	</fieldset>{/each}
</details>

{#if data.categories.length && data.series.length}<details><summary>Data points</summary>
	{#if data.series.length > 1}<label>Series<select bind:value={pointSeries}>{#each data.series as series, index}<option value={index}>{series.name}</option>{/each}</select></label>{/if}
	{#each data.categories as category, index}{#if activeSeries}<div class="point"><span title={category}>{category}</span><input aria-label="Point label" placeholder="Label" value={activeSeries.dataLabels?.find((label)=>label.idx===index)?.text ?? ''} onchange={(event) => labelPatch(pointSeries,index,event.currentTarget.value)} /><input type="color" aria-label="Point fill" value={activeSeries.dataPoints?.find((point)=>point.idx===index)?.spPr?.fillColor ?? activeSeries.color ?? '#4472c4'} onchange={(event) => pointPatch(pointSeries,index,{spPr:{...activeSeries.dataPoints?.find((point)=>point.idx===index)?.spPr,fillColor:event.currentTarget.value}})} />{#if ['pie','doughnut'].includes(data.chartType)}<input type="number" min="0" max="100" aria-label="Explosion" value={activeSeries.dataPoints?.find((point)=>point.idx===index)?.explosion ?? 0} onchange={(event) => pointPatch(pointSeries,index,{explosion:Number(event.currentTarget.value)})} />{/if}</div>{/if}{/each}
</details>{/if}

<style>details{margin-top:8px;border-top:1px solid var(--pptx-border);padding-top:7px}summary{cursor:pointer;font-weight:600}fieldset{display:grid;gap:6px;margin:6px 0;padding:6px;border:1px solid var(--pptx-border);border-radius:6px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}label{display:grid;gap:3px;color:var(--pptx-muted-foreground);font-size:10px}input,select{min-width:0;height:25px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}.point{display:grid;grid-template-columns:1fr 70px 32px 48px;gap:4px;align-items:center;margin-top:5px}.point span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style>
