<script setup lang="ts">
import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import {
	cellStyleToCss,
	getDiagonalBorders,
	getTableCellBandStyle,
} from '../composables/table-style';

/**
 * TableRenderer — Vue port of the React table renderer
 * (`viewer/utils/table-render.tsx` + `table-render-data.tsx`).
 *
 * Read-only, viewer-first. Renders a PPTX `table` element as a real HTML
 * `<table>` from the structured {@link PptxTableData} model that
 * `pptx-viewer-core` produces:
 *  - `<colgroup>` column widths (proportional)
 *  - per-row heights
 *  - per-cell fill / border / alignment / text effects
 *  - rowspan / colspan, skipping cells covered by a merge
 *  - banded-row / header-row / first-last emphasis
 *  - diagonal cell borders via an SVG overlay
 *
 * Not ported (editing concerns, see PORTING.md): resize handles, inline cell
 * editing, cell selection, and the raw-OOXML render path. Cell text is the
 * cell's plain string; rich per-run cell text is a future enhancement. Pattern
 * fills are approximated by their background colour.
 */
const props = defineProps<{
	element: PptxElement;
	/** Accepted for parity with `ElementRenderer`; unused (no image fills yet). */
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

/** The structured table data, when this element is a populated table. */
const tableData = computed<PptxTableData | undefined>(() => {
	const el = props.element;
	if (el.type !== 'table') {
		return undefined;
	}
	const td = el.tableData;
	return td && td.rows.length > 0 ? td : undefined;
});

const rowCount = computed(() => tableData.value?.rows.length ?? 0);
const columnCount = computed(() => tableData.value?.columnWidths.length ?? 0);

/** Column widths as CSS percentage strings for the `<colgroup>`. */
const columnPercentages = computed<string[]>(() =>
	(tableData.value?.columnWidths ?? []).map((w) => `${(w * 100).toFixed(2)}%`),
);

interface RenderableCell {
	key: string;
	colSpan?: number;
	rowSpan?: number;
	style: CSSProperties;
	text: string;
	diagonals: ReturnType<typeof getDiagonalBorders>;
}

interface RenderableRow {
	key: string;
	height?: number;
	cells: RenderableCell[];
}

/**
 * Build the renderable grid: skip cells covered by a merge (`hMerge`/`vMerge`),
 * resolve spans, and layer band style beneath the explicit cell style.
 */
const rows = computed<RenderableRow[]>(() => {
	const td = tableData.value;
	if (!td) {
		return [];
	}
	const id = props.element.id;
	const rCount = rowCount.value;
	const cCount = columnCount.value;

	return td.rows.map((row, rowIndex) => {
		const cells: RenderableCell[] = [];
		row.cells.forEach((cell, cellIndex) => {
			// Cells absorbed by a horizontal or vertical merge are not rendered;
			// the originating cell carries the span.
			if (cell.hMerge || cell.vMerge) {
				return;
			}

			const colSpan = cell.gridSpan && cell.gridSpan > 1 ? cell.gridSpan : undefined;
			const rowSpan = cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined;

			const bandStyle = getTableCellBandStyle(td, rowIndex, cellIndex, rCount, cCount);
			const cellStyle = cellStyleToCss(cell.style);
			// Explicit cell style wins over band style (mirrors the React layering).
			const style: CSSProperties = { ...bandStyle, ...cellStyle };

			cells.push({
				key: `${id}-cell-${rowIndex}-${cellIndex}`,
				colSpan,
				rowSpan,
				style,
				text: cell.text || ' ',
				diagonals: getDiagonalBorders(cell.style),
			});
		});

		return {
			key: `${id}-row-${rowIndex}`,
			height: row.height && row.height > 0 ? row.height : undefined,
			cells,
		};
	});
});
</script>

<template>
	<div
		v-if="tableData"
		class="pptx-vue-element pptx-vue-table"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<table class="pptx-vue-table__grid">
			<colgroup v-if="columnPercentages.length > 0">
				<col
					v-for="(width, ci) in columnPercentages"
					:key="`${element.id}-col-${ci}`"
					:style="{ width }"
				/>
			</colgroup>
			<tbody>
				<tr
					v-for="row in rows"
					:key="row.key"
					:style="row.height ? { height: `${row.height}px` } : undefined"
				>
					<td
						v-for="cell in row.cells"
						:key="cell.key"
						class="pptx-vue-table__cell"
						:colspan="cell.colSpan"
						:rowspan="cell.rowSpan"
						:style="cell.style"
					>
						<svg
							v-if="cell.diagonals"
							class="pptx-vue-table__diag"
							aria-hidden="true"
							preserveAspectRatio="none"
						>
							<line
								v-if="cell.diagonals.diagDownColor && cell.diagonals.diagDownWidth"
								x1="0"
								y1="0"
								x2="100%"
								y2="100%"
								:stroke="cell.diagonals.diagDownColor"
								:stroke-width="cell.diagonals.diagDownWidth"
							/>
							<line
								v-if="cell.diagonals.diagUpColor && cell.diagonals.diagUpWidth"
								x1="0"
								y1="100%"
								x2="100%"
								y2="0"
								:stroke="cell.diagonals.diagUpColor"
								:stroke-width="cell.diagonals.diagUpWidth"
							/>
						</svg>
						<span class="pptx-vue-table__text">{{ cell.text }}</span>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
.pptx-vue-table {
	overflow: hidden;
}

.pptx-vue-table__grid {
	width: 100%;
	height: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.pptx-vue-table__cell {
	position: relative;
	padding: 1px 4px;
	vertical-align: top;
	border: 1px solid rgba(255, 255, 255, 0.3);
	white-space: pre-wrap;
	word-break: break-word;
	overflow-wrap: break-word;
}

.pptx-vue-table__diag {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	overflow: visible;
}

.pptx-vue-table__text {
	position: relative;
}
</style>
