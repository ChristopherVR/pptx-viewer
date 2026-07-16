<script lang="ts">
	import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
	import { applyUniformCellPaddingPatch, tableInspectorPatch, tableInspectorStateOf } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import TableCellSection from './TableCellSection.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();
	const state = $derived(tableInspectorStateOf(el));
	const table = $derived(el.type === 'table' ? el.tableData : undefined);

	function patchData(next: Partial<PptxTableData>): void {
		if (el.type === 'table' && table) {
			editor.applyElementPatch(el.id, { tableData: { ...table, ...next } });
		}
	}

	function setCellPadding(value: string): void {
		const padding = Number(value);
		if (Number.isFinite(padding)) {
			editor.patchSelected(applyUniformCellPaddingPatch(el, padding));
		}
	}
</script>

{#if table}
	<div class="checks">
		{#each [['firstRowHeader', 'pptx.table.headerRow'], ['bandedRows', 'pptx.table.bandedRows'], ['bandedColumns', 'pptx.table.bandedColumns'], ['firstCol', 'pptx.table.firstColumn'], ['lastCol', 'pptx.table.lastColumn'], ['lastRow', 'pptx.table.lastRow']] as option}
			<label><input type="checkbox" checked={Boolean(table[option[0] as keyof PptxTableData])} onchange={(event) => editor.patchSelected(tableInspectorPatch(el, { [option[0]]: event.currentTarget.checked }))} />{t(option[1])}</label>
		{/each}
	</div>
	<label>Cell padding<input type="number" min="0" value={Math.round(state.cellPadding)} onchange={(event) => setCellPadding(event.currentTarget.value)} /></label>
	{#if table.bandedRows}<label>Row band cycle<input type="number" min="1" value={table.bandRowCycle ?? 1} onchange={(event) => patchData({ bandRowCycle: Math.max(1, Number(event.currentTarget.value)) })} /></label>{/if}
	{#if table.bandedColumns}<label>Column band cycle<input type="number" min="1" value={table.bandColCycle ?? 1} onchange={(event) => patchData({ bandColCycle: Math.max(1, Number(event.currentTarget.value)) })} /></label>{/if}
	<details><summary>Column widths</summary><button type="button" onclick={() => patchData({ columnWidths: table.columnWidths.map(() => 1 / table.columnWidths.length) })}>Distribute evenly</button>{#each table.columnWidths as width, index}<label>Column {index + 1}<input type="range" min="5" max="80" value={Math.round(width * 100)} onchange={(event) => { const next=[...table.columnWidths]; next[index]=Number(event.currentTarget.value)/100; const sum=next.reduce((a,b)=>a+b,0); patchData({columnWidths:next.map((value)=>value/sum)}); }} /></label>{/each}</details>
	<details><summary>Row heights</summary><button type="button" onclick={() => { const average=table.rows.reduce((sum,row)=>sum+(row.height??32),0)/table.rows.length; patchData({rows:table.rows.map((row)=>({...row,height:average}))}); }}>Distribute evenly</button>{#each table.rows as row, index}<label>Row {index + 1}<input type="number" min="16" max="500" value={row.height ?? 32} onchange={(event) => patchData({rows:table.rows.map((item,i)=>i===index?{...item,height:Number(event.currentTarget.value)}:item)})} /></label>{/each}</details>
	<TableCellSection {table} onpatch={patchData} />
{/if}

<style>.checks{display:grid;grid-template-columns:1fr 1fr;gap:6px}.checks label{display:flex;align-items:center}label{display:grid;gap:3px;margin-top:7px;color:var(--pptx-muted-foreground);font-size:10px}input{min-width:0;height:26px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}details{margin-top:8px}summary{cursor:pointer;font-weight:600}button{margin-top:6px;border:1px solid var(--pptx-border);border-radius:5px;padding:4px 7px;background:var(--pptx-muted);color:inherit}</style>
