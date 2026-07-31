<script lang="ts">
	import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
	import { computeMergeCellDown, computeMergeCellRight, computeSplitCell, FILL_PATTERN_LABEL_KEYS, schemaLabel } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const { table, onpatch }: { table: PptxTableData; onpatch: (patch: Partial<PptxTableData>) => void } = $props();
	const t = useTranslator();
	/**
	 * The pattern presets this select offers (the shared table covers all 56, so
	 * keeping the list here stops labelling them widening the control), plus the
	 * alignment wire values mapped onto the dictionary keys the text panel
	 * already uses for the same words.
	 *
	 * Both alignment selects used to be `<option>left</option>` with no `value`,
	 * where the option TEXT doubled as the submitted value. Now that the text is
	 * translated the `value` attribute has to be explicit, or a French user
	 * would write "Gauche" into the cell's `algn`.
	 */
	const patterns: readonly string[] = ['ltDnDiag', 'ltUpDiag', 'smGrid', 'lgGrid', 'pct20', 'pct50', 'zigZag'];
	const alignKeys: Readonly<Record<string, string>> = {
		left: 'pptx.textPanel.alignLeft',
		center: 'pptx.textPanel.alignCenter',
		right: 'pptx.textPanel.alignRight',
		justify: 'pptx.textPanel.alignJustify',
	};
	const vAlignKeys: Readonly<Record<string, string>> = {
		top: 'pptx.textPanel.valignTop',
		middle: 'pptx.textPanel.valignMiddle',
		bottom: 'pptx.textPanel.valignBottom',
	};
	const aligns: readonly string[] = ['left', 'center', 'right', 'justify'];
	const vAligns: readonly string[] = ['top', 'middle', 'bottom'];
	// eslint-disable-next-line prefer-const
	let rowIndex = $state(0);
	// eslint-disable-next-line prefer-const
	let columnIndex = $state(0);
	const cell = $derived(table.rows[rowIndex]?.cells[columnIndex]);
	const style = $derived(cell?.style ?? {});

	function patchStyle(next: Partial<PptxTableCellStyle>): void {
		onpatch({ rows: table.rows.map((row, ri) => ri === rowIndex ? { ...row, cells: row.cells.map((item, ci) => ci === columnIndex ? { ...item, style: { ...style, ...next } } : item) } : row) });
	}

	function merge(direction: 'right' | 'down' | 'split'): void {
		const rows = direction === 'right' ? computeMergeCellRight(table, rowIndex, columnIndex) : direction === 'down' ? computeMergeCellDown(table, rowIndex, columnIndex) : computeSplitCell(table, rowIndex, columnIndex);
		if (rows) {
			onpatch({ rows });
		}
	}

	function setFillMode(mode: PptxTableCellStyle['fillMode']): void {
		if (mode === 'gradient') {
			patchStyle({ fillMode: mode, gradientFillType: style.gradientFillType ?? 'linear', gradientFillAngle: style.gradientFillAngle ?? 90, gradientFillStops: style.gradientFillStops ?? [{ color: '#ff0000', position: 0 }, { color: '#0000ff', position: 100 }] });
		} else if (mode === 'pattern') {
			patchStyle({ fillMode: mode, patternFillPreset: style.patternFillPreset ?? 'ltDnDiag', patternFillForeground: style.patternFillForeground ?? '#000000', patternFillBackground: style.patternFillBackground ?? '#ffffff' });
		} else {
			patchStyle({ fillMode: mode });
		}
	}
</script>

<details open><summary>Cell formatting</summary>
	<div class="picker"><label>Row<select bind:value={rowIndex}>{#each table.rows as _, index}<option value={index}>{index + 1}</option>{/each}</select></label><label>Column<select bind:value={columnIndex}>{#each table.columnWidths as _, index}<option value={index}>{index + 1}</option>{/each}</select></label></div>
	{#if cell}<div class="grid"><label>Font size<input type="number" min="6" max="200" value={style.fontSize ?? 14} onchange={(event) => patchStyle({ fontSize: Number(event.currentTarget.value) })} /></label><label>Text color<input type="color" value={style.color ?? '#000000'} onchange={(event) => patchStyle({ color: event.currentTarget.value })} /></label><label>Background<input type="color" value={style.backgroundColor ?? '#ffffff'} onchange={(event) => patchStyle({ backgroundColor: event.currentTarget.value, fillMode: 'solid' })} /></label><label>Fill<select value={style.fillMode ?? 'solid'} onchange={(event) => setFillMode(event.currentTarget.value as PptxTableCellStyle['fillMode'])}><option value="solid">Solid</option><option value="gradient">Gradient</option><option value="pattern">Pattern</option><option value="none">None</option></select></label></div>
	<div class="buttons">{#each [['bold','B'],['italic','I'],['underline','U']] as option}<button class:active={Boolean(style[option[0] as keyof PptxTableCellStyle])} onclick={() => patchStyle({ [option[0]]: !style[option[0] as keyof PptxTableCellStyle] })}>{option[1]}</button>{/each}</div>
	<div class="grid"><label>Horizontal<select value={style.align ?? 'left'} onchange={(event) => patchStyle({ align: event.currentTarget.value as PptxTableCellStyle['align'] })}>{#each aligns as align}<option value={align}>{schemaLabel(alignKeys, align, t)}</option>{/each}</select></label><label>Vertical<select value={style.vAlign ?? 'top'} onchange={(event) => patchStyle({ vAlign: event.currentTarget.value as PptxTableCellStyle['vAlign'] })}>{#each vAligns as vAlign}<option value={vAlign}>{schemaLabel(vAlignKeys, vAlign, t)}</option>{/each}</select></label></div>
	{#if style.fillMode === 'gradient'}<div class="grid"><label>Type<select value={style.gradientFillType ?? 'linear'} onchange={(event) => patchStyle({ gradientFillType: event.currentTarget.value as 'linear' | 'radial' })}><option>linear</option><option>radial</option></select></label><label>Angle<input type="number" min="0" max="360" value={style.gradientFillAngle ?? 90} onchange={(event) => patchStyle({ gradientFillAngle: Number(event.currentTarget.value) })} /></label>{#each style.gradientFillStops ?? [] as stop, index}<label>Stop {index + 1}<input type="color" value={stop.color} onchange={(event) => patchStyle({ gradientFillStops: (style.gradientFillStops ?? []).map((item,i)=>i===index?{...item,color:event.currentTarget.value}:item) })} /></label>{/each}</div>{/if}
	{#if style.fillMode === 'pattern'}<div class="grid"><label>Pattern<select value={style.patternFillPreset ?? 'ltDnDiag'} onchange={(event) => patchStyle({ patternFillPreset: event.currentTarget.value })}>{#each patterns as pattern}<option value={pattern}>{schemaLabel(FILL_PATTERN_LABEL_KEYS, pattern, t)}</option>{/each}</select></label><label>Foreground<input type="color" value={style.patternFillForeground ?? '#000000'} onchange={(event) => patchStyle({ patternFillForeground: event.currentTarget.value })} /></label><label>Background<input type="color" value={style.patternFillBackground ?? '#ffffff'} onchange={(event) => patchStyle({ patternFillBackground: event.currentTarget.value })} /></label></div>{/if}
	<div class="grid">{#each [['marginTop','Top margin'],['marginBottom','Bottom margin'],['marginLeft','Left margin'],['marginRight','Right margin']] as item}<label>{item[1]}<input type="number" min="0" value={Number(style[item[0] as keyof PptxTableCellStyle] ?? 0)} onchange={(event) => patchStyle({ [item[0]]: Number(event.currentTarget.value) })} /></label>{/each}</div>
	<h6>Borders</h6><div class="grid">{#each [['borderTop','Top'],['borderBottom','Bottom'],['borderLeft','Left'],['borderRight','Right']] as edge}<label>{edge[1]} color<input type="color" value={String(style[`${edge[0]}Color` as keyof PptxTableCellStyle] ?? '#374151')} onchange={(event) => patchStyle({ [`${edge[0]}Color`]: event.currentTarget.value })} /></label><label>{edge[1]} width<input type="number" min="0" max="10" value={Number(style[`${edge[0]}Width` as keyof PptxTableCellStyle] ?? 1)} onchange={(event) => patchStyle({ [`${edge[0]}Width`]: Number(event.currentTarget.value) })} /></label>{/each}</div>
	<div class="merge"><button onclick={() => merge('right')}>Merge right</button><button onclick={() => merge('down')}>Merge down</button><button onclick={() => merge('split')}>Split</button></div>{/if}
</details>

<style>details{margin-top:10px;border-top:1px solid var(--pptx-border);padding-top:8px}summary{cursor:pointer;font-weight:600}.picker,.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.buttons,.merge{display:flex;gap:5px;margin-top:7px}label{display:grid;gap:3px;margin-top:6px;color:var(--pptx-muted-foreground);font-size:10px}input,select{min-width:0;height:25px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}button{border:1px solid var(--pptx-border);border-radius:5px;padding:4px 7px;background:var(--pptx-muted);color:inherit}.active{background:var(--pptx-primary);color:#fff}h6{margin:8px 0 0}</style>
