<script lang="ts">
	/**
	 * TableView: renders `table` elements as a real HTML `<table>` built from
	 * the structured `PptxTableData` model (Svelte port of the vanilla / Vue
	 * table renderer, read-only path). Covers `<colgroup>` proportional column
	 * widths, per-row heights, rowspan/colspan (merge-absorbed cells skipped),
	 * banded-row / header-row emphasis, per-cell fills / borders / alignment,
	 * pattern fills, diagonal borders (SVG overlay), and rich per-run text.
	 * All style resolution lives in `render/table-view.ts` + shared helpers.
	 */
	import { buildTableRows, columnWidthStyles } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import { useTableStyleContext } from '../state/render-context';
	import type { ElementRendererProps } from './props';

	const { element, zIndex, interactive = false, ontablecellcommit }: ElementRendererProps = $props();

	const tableData = $derived(element.type === 'table' ? element.tableData : undefined);
	const tableStyleContext = $derived(useTableStyleContext());
	const rows = $derived(tableData ? buildTableRows(tableData, tableStyleContext) : []);
	const colWidths = $derived(tableData ? columnWidthStyles(tableData) : []);
	const containerStyle = $derived(
		styleToString({ ...getContainerStyle(element, zIndex), overflow: 'hidden' }),
	);
	let editingKey = $state<string | null>(null);
	let draft = $state('');

	function begin(cell: (typeof rows)[number]['cells'][number], event: MouseEvent): void {
		if (!interactive || !ontablecellcommit) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		editingKey = cell.key;
		draft = cell.text.trim();
	}

	function commit(cell: (typeof rows)[number]['cells'][number]): void {
		if (editingKey !== cell.key) {
			return;
		}
		ontablecellcommit?.(element.id, cell.rowIndex, cell.cellIndex, draft);
		editingKey = null;
	}

	function focusInput(node: HTMLInputElement): void {
		queueMicrotask(() => {
			node.focus();
			node.select();
		});
	}

	$effect(() => {
		if (!editingKey) {
			return;
		}
		const onOutsidePointerDown = (event: PointerEvent): void => {
			const clickedEditor = event
				.composedPath()
				.some((target) => target instanceof Element && target.hasAttribute('data-inline-editor'));
			if (clickedEditor) {
				return;
			}
			const cell = rows.flatMap((row) => row.cells).find((candidate) => candidate.key === editingKey);
			if (cell) {
				commit(cell);
			}
		};
		document.addEventListener('pointerdown', onOutsidePointerDown, true);
		return () => document.removeEventListener('pointerdown', onOutsidePointerDown, true);
	});
</script>

{#if tableData && rows.length > 0}
	<div class="pptx-svelte-element pptx-svelte-table" style={containerStyle} data-element-id={element.id} data-pptx-element={interactive ? 'true' : undefined}>
		<table class="pptx-svelte-table-grid">
			{#if colWidths.length > 0}
				<colgroup>
					{#each colWidths as width, i (i)}
						<col style={width} />
					{/each}
				</colgroup>
			{/if}
			<tbody>
				{#each rows as row (row.key)}
					<tr style={row.style}>
						{#each row.cells as cell (cell.key)}
							<!-- The model coordinates travel on the cell itself: the canvas
							     context menu reads them back off the DOM to target its row /
							     column / merge commands, and merge-absorbed cells are not
							     rendered, so a cell's DOM position is not its model position. -->
							<td class="pptx-svelte-table-cell" data-cell-row={cell.rowIndex} data-cell-col={cell.cellIndex} colspan={cell.colSpan} rowspan={cell.rowSpan} style={cell.style} ondblclick={(event) => begin(cell, event)}>
								{#if cell.diagonals}
									<!-- Diagonal cell borders as an absolutely positioned SVG overlay. -->
									<svg
										class="pptx-svelte-table-diag"
										aria-hidden="true"
										preserveAspectRatio="none"
										style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible"
									>
										{#if cell.diagonals.diagDownColor && cell.diagonals.diagDownWidth}
											<line
												x1="0"
												y1="0"
												x2="100%"
												y2="100%"
												stroke={cell.diagonals.diagDownColor}
												stroke-width={cell.diagonals.diagDownWidth}
											/>
										{/if}
										{#if cell.diagonals.diagUpColor && cell.diagonals.diagUpWidth}
											<line
												x1="0"
												y1="100%"
												x2="100%"
												y2="0"
												stroke={cell.diagonals.diagUpColor}
												stroke-width={cell.diagonals.diagUpWidth}
											/>
										{/if}
									</svg>
								{/if}
								{#if editingKey === cell.key}
									<input use:focusInput data-inline-editor type="text" bind:value={draft} onpointerdown={(event) => event.stopPropagation()} onclick={(event) => event.stopPropagation()} onblur={() => commit(cell)} onkeydown={(event) => { if (event.key === 'Enter') commit(cell); else if (event.key === 'Escape') editingKey = null; }} />
								{:else if cell.runs}
									{#each cell.runs as run (run.key)}
										{#if run.isParagraphBreak}
											<div class="pptx-svelte-table-para-break" style="display: block; height: 0"></div>
										{:else if run.isLineBreak}
											<br />
										{:else}
											<span class="pptx-svelte-table-run" style={run.style}>{run.text}</span>
										{/if}
									{/each}
								{:else}
									<span class="pptx-svelte-table-text" style="position: relative">{cell.text}</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.pptx-svelte-table-grid {
		width: 100%;
		height: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	.pptx-svelte-table-cell input { box-sizing:border-box; width:100%; min-width:0; border:1px solid var(--pptx-primary,#6366f1); background:white; color:#111827; font:inherit; }
</style>
