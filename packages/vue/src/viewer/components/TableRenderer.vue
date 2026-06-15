<script setup lang="ts">
import type {
	ParsedTableStyleMap,
	PptxElement,
	PptxTableCellStyle,
	PptxTableData,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import type {
	CellPatternFillCss,
	CellTextRun,
	TableCellCss,
	TableStyleContext,
} from 'pptx-viewer-shared';
import {
	cellPatternFillCss,
	cellRunStyle,
	cellStyleToCss,
	getDiagonalBorders,
	getTableCellBandStyle,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import { injectTableTheme, resolveTableTheme } from '../composables/table-theme';

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
 *  - banded-row / header-row / first-last emphasis (theme-aware when
 *    `colorScheme` + `tableStyleMap` props are supplied)
 *  - pattern fills rendered as tiled inline SVG (not a flat colour)
 *  - rich per-run cell text via optional `CellTextRun[]` on cells
 *  - diagonal cell borders via an SVG overlay
 *
 * Not ported (editing concerns, see PORTING.md): resize handles, inline cell
 * editing, cell selection, and the raw-OOXML render path.
 */
const props = defineProps<{
	element: PptxElement;
	/** Accepted for parity with `ElementRenderer`; unused (no image fills yet). */
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
	/**
	 * PPTX theme colour scheme from the active presentation theme.
	 * When supplied, band / header emphasis colours are resolved against
	 * the real scheme instead of using hardcoded fallback colours.
	 */
	colorScheme?: PptxThemeColorScheme;
	/**
	 * Parsed table style map (from `ppt/tableStyles.xml`).
	 * Enables accurate banding / header style lookups by table style GUID.
	 */
	tableStyleMap?: ParsedTableStyleMap;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

// Viewer-root-provided theme context (colour scheme / table-style map), used as
// a fallback for band/header colour resolution when the props are not supplied.
const injectedTableTheme = injectTableTheme();

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

/**
 * Resolve pattern-fill CSS for a cell's style.
 *
 * Returns the resolved {@link CellPatternFillCss} (with `backgroundImage`
 * and/or `backgroundColor`) when the cell has a pattern fill, or `null`
 * otherwise.
 */
function resolvePatternFill(style: PptxTableCellStyle): CellPatternFillCss | null {
	return cellPatternFillCss(style);
}

interface RenderableCell {
	key: string;
	colSpan?: number;
	rowSpan?: number;
	/** Base style (band + explicit, minus pattern-fill overrides). */
	style: TableCellCss;
	/**
	 * Resolved pattern-fill properties. When non-null the template applies
	 * `backgroundImage` (tiled SVG) and `backgroundColor` separately so
	 * the SVG tile is drawn on top of the solid background colour.
	 */
	patternFill: CellPatternFillCss | null;
	/**
	 * Rich text runs for this cell. When non-null, the template renders
	 * each run as a styled `<span>` element (with paragraph/line breaks);
	 * when null, the plain `text` string is rendered instead.
	 */
	textRuns: CellTextRun[] | null;
	/** Plain-text fallback rendered when `textRuns` is null. */
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

	// Props win; otherwise fall back to the viewer-root-provided theme context
	// so banded/header colours still resolve without prop-threading the theme.
	const injected = resolveTableTheme(injectedTableTheme);
	const colorScheme = props.colorScheme ?? injected?.colorScheme;
	const tableStyleMap = props.tableStyleMap ?? injected?.tableStyleMap;
	const styleCtx: TableStyleContext | undefined =
		colorScheme || tableStyleMap ? { colorScheme, tableStyleMap } : undefined;

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

			const bandStyle = getTableCellBandStyle(td, rowIndex, cellIndex, rCount, cCount, styleCtx);
			const cellStyle = cellStyleToCss(cell.style);
			// Explicit cell style wins over band style (mirrors the React layering).
			const style: TableCellCss = { ...bandStyle, ...cellStyle };

			// Pattern fill: resolve separately so the Vue template can apply
			// `backgroundImage` in addition to `backgroundColor`.
			const patternFill = cell.style ? resolvePatternFill(cell.style) : null;

			// Rich per-run text: the cell type carries an optional `textRuns`
			// field (duck-typed; not in the published core interface yet).
			// When present, render styled spans; otherwise fall back to the
			// plain `cell.text` string.
			const cellAsRich = cell as typeof cell & { textRuns?: CellTextRun[] };
			const textRuns =
				cellAsRich.textRuns && cellAsRich.textRuns.length > 0 ? cellAsRich.textRuns : null;

			cells.push({
				key: `${id}-cell-${rowIndex}-${cellIndex}`,
				colSpan,
				rowSpan,
				style,
				patternFill,
				textRuns,
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

/**
 * Build the computed inline style for a `<td>`, merging the base `TableCellCss`
 * with any pattern-fill overrides (backgroundImage + backgroundColor).
 */
function tdStyle(cell: RenderableCell): TableCellCss {
	if (!cell.patternFill) {
		return cell.style;
	}
	// Pattern fill overrides the solid backgroundColor that `cellStyleToCss` may
	// have set, replacing it with the backgroundImage + the solid bg behind it.
	const merged: TableCellCss = { ...cell.style };
	delete merged['backgroundColor'];
	delete merged['background'];
	if (cell.patternFill.backgroundImage) {
		merged['backgroundImage'] = cell.patternFill.backgroundImage;
	}
	if (cell.patternFill.backgroundColor) {
		merged['backgroundColor'] = cell.patternFill.backgroundColor;
	}
	return merged;
}

/**
 * Convert a {@link CellTextRun} to an inline style object for a `<span>`.
 * Delegates to the framework-agnostic `cellRunStyle` helper.
 */
function runStyle(run: CellTextRun): TableCellCss {
	return cellRunStyle(run);
}
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
						:style="tdStyle(cell)"
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

						<!--
							Rich per-run text: when `textRuns` is present each run is
							a styled <span>. Paragraph breaks become block-level <div>s;
							line breaks become <br> within a paragraph.
						-->
						<template v-if="cell.textRuns">
							<template v-for="(run, ri) in cell.textRuns" :key="`${cell.key}-run-${ri}`">
								<div v-if="run.isParagraphBreak" class="pptx-vue-table__para-break" />
								<br v-else-if="run.isLineBreak" />
								<span v-else class="pptx-vue-table__run" :style="runStyle(run)">{{
									run.text
								}}</span>
							</template>
						</template>
						<!--
							Plain-text fallback: rendered when no per-run data is available.
						-->
						<span v-else class="pptx-vue-table__text">{{ cell.text }}</span>
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

.pptx-vue-table__run {
	position: relative;
}

.pptx-vue-table__para-break {
	display: block;
	height: 0;
}
</style>
