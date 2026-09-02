<script lang="ts">
	import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
	import {
		applyTableStylePreset,
		applyUniformCellPaddingPatch,
		deleteTableColumn,
		deleteTableRow,
		evenColumnWidths,
		evenRowHeights,
		insertTableColumn,
		insertTableRow,
		redistributeColumnWidth,
		TABLE_STYLE_PRESETS,
		tableInspectorPatch,
		tableInspectorStateOf,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import TableCellSection from './TableCellSection.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();
	const inspectorState = $derived(tableInspectorStateOf(el));
	const table = $derived(el.type === 'table' ? el.tableData : undefined);
	// eslint-disable-next-line prefer-const
	let activeRow = $state(0);
	// eslint-disable-next-line prefer-const
	let activeColumn = $state(0);

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
	<div class="presets">
		<span class="presets-label">{t('pptx.table.stylePresets')}</span>
		<div class="presets-grid">
			{#each TABLE_STYLE_PRESETS as preset (preset.id)}
				<button
					type="button"
					class="preset-swatch"
					title={preset.label}
					aria-label={preset.label}
					onclick={() => patchData({ rows: applyTableStylePreset(table, preset) })}
				>
					<span style:background={preset.headerBg}></span>
					<span style:background={preset.bandBg}></span>
					<span style:border-top-color={preset.borderColor}></span>
				</button>
			{/each}
		</div>
	</div>
	<label>Cell padding<input type="number" min="0" value={Math.round(inspectorState.cellPadding)} onchange={(event) => setCellPadding(event.currentTarget.value)} /></label>
	<div class="structure"><label>Row<input type="number" min="1" max={table.rows.length} value={activeRow + 1} onchange={(event) => (activeRow = Math.max(0, Number(event.currentTarget.value) - 1))} /></label><button type="button" onclick={() => patchData(insertTableRow(table, activeRow, 'below'))}>Insert row</button><button type="button" disabled={table.rows.length <= 1} onclick={() => patchData(deleteTableRow(table, activeRow))}>Delete row</button><label>Column<input type="number" min="1" max={table.columnWidths.length} value={activeColumn + 1} onchange={(event) => (activeColumn = Math.max(0, Number(event.currentTarget.value) - 1))} /></label><button type="button" onclick={() => patchData(insertTableColumn(table, activeColumn, 'right'))}>Insert column</button><button type="button" disabled={table.columnWidths.length <= 1} onclick={() => patchData(deleteTableColumn(table, activeColumn))}>Delete column</button></div>
	{#if table.bandedRows}<label>Row band cycle<input type="number" min="1" value={table.bandRowCycle ?? 1} onchange={(event) => patchData({ bandRowCycle: Math.max(1, Number(event.currentTarget.value)) })} /></label>{/if}
	{#if table.bandedColumns}<label>Column band cycle<input type="number" min="1" value={table.bandColCycle ?? 1} onchange={(event) => patchData({ bandColCycle: Math.max(1, Number(event.currentTarget.value)) })} /></label>{/if}
	<details><summary>Column widths</summary><button type="button" onclick={() => patchData({ columnWidths: evenColumnWidths(table.columnWidths.length) })}>Distribute evenly</button>{#each table.columnWidths as width, index}<label>Column {index + 1}<input type="range" min="5" max="80" value={Math.round(width * 100)} onchange={(event) => patchData({ columnWidths: redistributeColumnWidth(table.columnWidths, index, Number(event.currentTarget.value) / 100) })} /></label>{/each}</details>
	<details><summary>Row heights</summary><button type="button" onclick={() => patchData({ rows: evenRowHeights(table.rows) })}>Distribute evenly</button>{#each table.rows as row, index}<label>Row {index + 1}<input type="number" min="16" max="500" value={row.height ?? 32} onchange={(event) => patchData({rows:table.rows.map((item,i)=>i===index?{...item,height:Number(event.currentTarget.value)}:item)})} /></label>{/each}</details>
	<TableCellSection {editor} {table} onpatch={patchData} />
{/if}

<style>.checks{display:grid;grid-template-columns:1fr 1fr;gap:6px}.checks label{display:flex;align-items:center}.structure{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;align-items:end;margin-top:7px}.structure button{height:26px}label{display:grid;gap:3px;margin-top:7px;color:var(--pptx-muted-foreground);font-size:10px}input{min-width:0;height:26px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}details{margin-top:8px}summary{cursor:pointer;font-weight:600}button{margin-top:6px;border:1px solid var(--pptx-border);border-radius:5px;padding:4px 7px;background:var(--pptx-muted);color:inherit}.presets{margin-top:7px}.presets-label{display:block;margin-bottom:4px;color:var(--pptx-muted-foreground);font-size:10px}.presets-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.preset-swatch{display:flex;flex-direction:column;height:40px;margin:0;padding:0;overflow:hidden;border:1px solid var(--pptx-border);border-radius:5px;background:none;cursor:pointer}.preset-swatch:hover{border-color:var(--pptx-primary,#c43b32)}.preset-swatch span{flex:1}.preset-swatch span:last-child{border-top:1px solid}</style>
