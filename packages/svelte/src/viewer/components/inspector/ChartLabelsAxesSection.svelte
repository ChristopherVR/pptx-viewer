<script lang="ts">
	import type { PptxChartAxisFormatting, PptxChartData, PptxChartDataLabelOptions, PptxChartStyle } from 'pptx-viewer-core';
	import {
		CHART_AXIS_TYPE_LABEL_KEYS,
		CHART_DATA_LABEL_POSITION_LABEL_KEYS,
		CHART_GRIDLINE_DASH_LABEL_KEYS,
		schemaLabel,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const {
		editor,
		data,
		onpatch,
	}: { editor: EditorState; data: PptxChartData; onpatch: (patch: Partial<PptxChartData>) => void } =
		$props();
	const t = useTranslator();
	const labels = $derived(data.style?.dataLabels ?? {});
	/**
	 * Wire values the two token-driven selects offer. The lists stay explicit
	 * (rather than being read off the label tables, which cover every value the
	 * schema allows) so translating a caption can never widen a control.
	 *
	 * `dashStyles` used to be `<option>solid</option>` with no `value`, where the
	 * option TEXT doubled as the submitted value; spelling the label out means
	 * the `value` attribute now has to be explicit or the edit would write
	 * "Solid" into `a:prstDash`.
	 */
	const labelPositions: readonly NonNullable<PptxChartDataLabelOptions['position']>[] = [
		'bestFit',
		'b',
		'ctr',
		'inBase',
		'inEnd',
		'l',
		'outEnd',
		'r',
		't',
	];
	const dashStyles: readonly string[] = ['solid', 'dash', 'dot', 'lgDash'];
	function stylePatch(next: Partial<PptxChartStyle>): void { onpatch({ style: { ...data.style, ...next } }); }
	function labelPatch(next: Partial<PptxChartDataLabelOptions>): void { stylePatch({ dataLabels: { ...labels, ...next } }); }
	function axisPatch(index: number, next: Partial<PptxChartAxisFormatting>): void { onpatch({ axes: (data.axes ?? []).map((axis, i) => i === index ? { ...axis, ...next } : axis) }); }
	function axisColorPatch(index: number, next: Partial<PptxChartAxisFormatting>, color: string): void {
		axisPatch(index, next);
		editor.recordRecentColor(color);
	}
</script>

{#if data.style?.hasDataLabels}<details><summary>Data label options</summary><div class="checks">{#each [['showValue','Value'],['showCategory','Category'],['showSeriesName','Series name'],['showPercent','Percentage'],['showLegendKey','Legend key'],['showLeaderLines','Leader lines']] as item}<label><input type="checkbox" checked={Boolean(labels[item[0] as keyof PptxChartDataLabelOptions])} onchange={(event) => labelPatch({ [item[0]]: event.currentTarget.checked })} />{item[1]}</label>{/each}</div><label>Position<select aria-label="Position" value={labels.position ?? ''} onchange={(event) => labelPatch({ position: (event.currentTarget.value || undefined) as PptxChartDataLabelOptions['position'] })}><option value="">Automatic</option>{#each labelPositions as position}<option value={position}>{schemaLabel(CHART_DATA_LABEL_POSITION_LABEL_KEYS, position, t)}</option>{/each}</select></label><label>Separator<input value={labels.separator ?? ''} onchange={(event) => labelPatch({ separator: event.currentTarget.value || undefined })} /></label></details>{/if}

{#if data.axes?.length}<details><summary>Axis styling</summary>{#each data.axes as axis, index}<fieldset><legend>{schemaLabel(CHART_AXIS_TYPE_LABEL_KEYS, axis.axisType, t)}</legend><div class="checks"><label><input type="checkbox" checked={axis.deleted ?? false} onchange={(event) => axisPatch(index,{deleted:event.currentTarget.checked})} />Hidden</label><label><input type="checkbox" checked={axis.logScale ?? false} onchange={(event) => axisPatch(index,{logScale:event.currentTarget.checked,logBase:event.currentTarget.checked?(axis.logBase??10):undefined})} />Log scale</label><label><input type="checkbox" checked={axis.majorGridlines ?? false} onchange={(event) => axisPatch(index,{majorGridlines:event.currentTarget.checked})} />Major gridlines</label><label><input type="checkbox" checked={axis.minorGridlines ?? false} onchange={(event) => axisPatch(index,{minorGridlines:event.currentTarget.checked})} />Minor gridlines</label></div><div class="grid"><label>Log base<input type="number" min="2" value={axis.logBase ?? 10} onchange={(event)=>axisPatch(index,{logBase:Number(event.currentTarget.value)})} /></label><label>Major unit<input type="number" value={axis.majorUnit ?? ''} onchange={(event)=>axisPatch(index,{majorUnit:event.currentTarget.value?Number(event.currentTarget.value):undefined})} /></label><label>Minor unit<input type="number" value={axis.minorUnit ?? ''} onchange={(event)=>axisPatch(index,{minorUnit:event.currentTarget.value?Number(event.currentTarget.value):undefined})} /></label><label>Orientation<select aria-label="Orientation" value={axis.orientation ?? 'minMax'} onchange={(event)=>axisPatch(index,{orientation:event.currentTarget.value as PptxChartAxisFormatting['orientation']})}><option value="minMax">Minimum to maximum</option><option value="maxMin">Maximum to minimum</option></select></label><label>Title font<input value={axis.fontFamily ?? ''} onchange={(event)=>axisPatch(index,{fontFamily:event.currentTarget.value||undefined})} /></label><label>Title size<input type="number" value={axis.fontSize ?? ''} onchange={(event)=>axisPatch(index,{fontSize:event.currentTarget.value?Number(event.currentTarget.value):undefined})} /></label><label>Title color<input type="color" value={axis.fontColor ?? '#000000'} onchange={(event)=>axisColorPatch(index,{fontColor:event.currentTarget.value},event.currentTarget.value)} /></label><label class="inline"><input type="checkbox" checked={axis.fontBold ?? false} onchange={(event)=>axisPatch(index,{fontBold:event.currentTarget.checked})} />Bold title</label></div>{#if axis.majorGridlines}<div class="grid"><label>Grid color<input type="color" value={axis.majorGridlinesSpPr?.strokeColor ?? '#d9d9d9'} onchange={(event)=>axisColorPatch(index,{majorGridlinesSpPr:{...axis.majorGridlinesSpPr,strokeColor:event.currentTarget.value}},event.currentTarget.value)} /></label><label>Grid width<input type="number" min="0.25" step="0.25" value={axis.majorGridlinesSpPr?.strokeWidth ?? 1} onchange={(event)=>axisPatch(index,{majorGridlinesSpPr:{...axis.majorGridlinesSpPr,strokeWidth:Number(event.currentTarget.value)}})} /></label><label>Grid dash<select aria-label="Grid dash" value={axis.majorGridlinesSpPr?.strokeDashStyle ?? 'solid'} onchange={(event)=>axisPatch(index,{majorGridlinesSpPr:{...axis.majorGridlinesSpPr,strokeDashStyle:event.currentTarget.value}})}>{#each dashStyles as dash}<option value={dash}>{schemaLabel(CHART_GRIDLINE_DASH_LABEL_KEYS, dash, t)}</option>{/each}</select></label></div>{/if}</fieldset>{/each}</details>{/if}

<style>details{margin-top:8px;border-top:1px solid var(--pptx-border);padding-top:7px}summary{cursor:pointer;font-weight:600}.checks,.grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.checks label,.inline{display:flex;align-items:center}fieldset{margin:6px 0;padding:6px;border:1px solid var(--pptx-border);border-radius:6px}label{display:grid;gap:3px;margin-top:5px;color:var(--pptx-muted-foreground);font-size:10px}input,select{min-width:0;height:25px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}</style>
