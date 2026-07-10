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
	import type { ElementRendererProps } from './props';

	const { element, zIndex }: ElementRendererProps = $props();

	const tableData = $derived(element.type === 'table' ? element.tableData : undefined);
	const rows = $derived(tableData ? buildTableRows(tableData) : []);
	const colWidths = $derived(tableData ? columnWidthStyles(tableData) : []);
	const containerStyle = $derived(
		styleToString({ ...getContainerStyle(element, zIndex), overflow: 'hidden' }),
	);
</script>

{#if tableData && rows.length > 0}
	<div class="pptx-svelte-element pptx-svelte-table" style={containerStyle} data-element-id={element.id}>
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
							<td class="pptx-svelte-table-cell" colspan={cell.colSpan} rowspan={cell.rowSpan} style={cell.style}>
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
								{#if cell.runs}
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
</style>
