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
import type { ComponentPublicInstance, CSSProperties } from 'vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import { injectTableCellEdit } from '../composables/table-edit';
import { injectTableSelection, useTableCellSelection } from '../composables/table-selection';
import { injectTableTheme, resolveTableTheme } from '../composables/table-theme';
import { DEFAULT_TEXT_COLOR } from '../constants';
import TableResizeOverlay from './TableResizeOverlay.vue';

/**
 * TableRenderer - Vue port of the React table renderer
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
 * Editing affordances (inline cell text edit, cell selection + Shift+range
 * highlight, and column/row drag-resize handles) are layered on when an edit
 * context is provided. The raw-OOXML render path is not ported.
 */
const props = defineProps<{
	element: PptxElement;
	/** Accepted for parity with `ElementRenderer`; unused (no image fills yet). */
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
	/**
	 * Whether this table is in an interactive context (main editable canvas).
	 * When false (e.g. in a slide thumbnail), resize handles and cell editing
	 * are disabled regardless of the injected editing context.
	 */
	interactive?: boolean;
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
	/** Original grid coordinates (used as the edit target / commit key). */
	rowIndex: number;
	colIndex: number;
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
			// Default body-cell text to the dark slide-text colour when nothing
			// (cell style, band/header emphasis, or per-run colour) sets one.
			// Otherwise the cell inherits the dark-UI chrome `foreground`
			// (near-white), rendering invisible on a light table; React resolves
			// these cells to DEFAULT_TEXT_COLOR (#111827). Per-run colours still win
			// because their `<span>` overrides this cascaded `<td>` colour.
			if (style.color === undefined) {
				style.color = DEFAULT_TEXT_COLOR;
			}

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
				rowIndex,
				colIndex: cellIndex,
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

// ---------------------------------------------------------------------------
// Inline cell editing (mirrors React TableCellInput + Angular TableRenderer).
// Provided once at the viewer root; absent in a read-only viewer, in which case
// the table renders without any edit affordance.
// ---------------------------------------------------------------------------

const cellEdit = injectTableCellEdit();

// Cell selection + resize context (provided at the viewer root; absent in a
// read-only viewer). `useTableCellSelection` derives the per-cell highlight
// state and the click handler; the injected context also carries the resize
// commit callbacks driven by the overlay.
const tableSelectionCtx = injectTableSelection();
const cellSelection = useTableCellSelection(
	() => props.element.id,
	() => tableData.value,
);

/** Single click selects a cell; Shift+click extends a rectangular range. */
function onCellClick(event: MouseEvent, cell: RenderableCell): void {
	if (!editingEnabled.value) {
		return;
	}
	event.stopPropagation();
	cellSelection.selectCell(cell.rowIndex, cell.colIndex, event.shiftKey);
}

function onResizeColumns(widths: number[]): void {
	tableSelectionCtx?.resizeColumns(props.element.id, widths);
}

function onResizeRow(rowIndex: number, height: number): void {
	tableSelectionCtx?.resizeRow(props.element.id, rowIndex, height);
}

/** The cell currently being edited (original grid coords), or null. */
const editingCell = ref<{ rowIndex: number; colIndex: number } | null>(null);
/** Live text for the active edit, seeded from the cell on entry. */
const editText = ref('');
/** The mounted `<input>` for the active edit, focused + select-all on mount. */
const cellInputRef = ref<HTMLInputElement | null>(null);

/**
 * Function template ref: the input lives inside a `v-for`, so a string ref
 * would collect an array. Only one cell edits at a time (guarded by `v-if`),
 * so capture the single element here and clear it on unmount.
 */
function setCellInput(el: Element | ComponentPublicInstance | null): void {
	cellInputRef.value = el instanceof HTMLInputElement ? el : null;
}

const editingEnabled = computed(
	() => (props.interactive ?? true) && (cellEdit?.canEdit() ?? false),
);

function isEditing(cell: RenderableCell): boolean {
	const e = editingCell.value;
	return e !== null && e.rowIndex === cell.rowIndex && e.colIndex === cell.colIndex;
}

// ── Touch double-tap detection ────────────────────────────────────────────
// On mobile, `dblclick` is not reliably synthesised from two quick taps.
// React/Angular detect the double-tap manually in their canvas pointerdown
// handler; Vue must do the same per-cell so tapping a cell twice on touch
// correctly enters inline edit mode.
const DOUBLE_TAP_MS = 400;
const lastCellTap = ref<{ rowIndex: number; colIndex: number; time: number } | null>(null);

/** Detect touch double-tap on a cell (native dblclick is unreliable on touch). */
function onCellPointerDown(event: PointerEvent, cell: RenderableCell): void {
	if (event.pointerType === 'mouse' || !editingEnabled.value) {
		return;
	}
	const now = event.timeStamp || Date.now();
	const last = lastCellTap.value;
	if (
		last &&
		last.rowIndex === cell.rowIndex &&
		last.colIndex === cell.colIndex &&
		now - last.time < DOUBLE_TAP_MS
	) {
		lastCellTap.value = null;
		event.stopPropagation();
		enterCellEdit(cell);
		return;
	}
	lastCellTap.value = { rowIndex: cell.rowIndex, colIndex: cell.colIndex, time: now };
}

/** Enter inline cell editing for the given cell. */
function enterCellEdit(cell: RenderableCell): void {
	editText.value = cell.text === ' ' ? '' : cell.text;
	editingCell.value = { rowIndex: cell.rowIndex, colIndex: cell.colIndex };
}

/** Double-tap / double-click on a cell enters inline edit mode. */
function onCellDblClick(event: Event, cell: RenderableCell): void {
	if (!editingEnabled.value) {
		return;
	}
	event.stopPropagation();
	enterCellEdit(cell);
}

/** Commit the current edit (called on blur). No-ops if already cancelled. */
function commitCellEdit(): void {
	const cell = editingCell.value;
	if (!cell) {
		return;
	}
	editingCell.value = null;
	cellEdit?.commit(props.element.id, cell.rowIndex, cell.colIndex, editText.value);
}

/** Enter / Tab commit; Escape cancels. Stops propagation so the canvas ignores it. */
function onCellInputKeydown(event: KeyboardEvent): void {
	event.stopPropagation();
	if (event.key === 'Enter' || event.key === 'Tab') {
		event.preventDefault();
		// Commit directly: commitCellEdit clears editingCell first, so the
		// ensuing blur (when the input unmounts) finds null and no-ops.
		commitCellEdit();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		// Clear first so the ensuing blur's commitCellEdit no-ops (discards edit).
		editingCell.value = null;
	}
}

// Focus + select-all the input as soon as it mounts (mirrors React's
// TableCellInput useEffect: focus(); select();).
// Also install a document-level pointerdown listener to commit on tap-away:
// on mobile, the browser does not reliably blur an <input> when tapping a
// non-focusable element elsewhere. A global listener ensures the edit is
// committed regardless of where the tap lands (matching React's behaviour
// where setPointerCapture on the canvas stage forces blur).
let docListener: ((e: PointerEvent) => void) | null = null;

watch(editingCell, (cell) => {
	if (cell) {
		void nextTick(() => {
			const el = cellInputRef.value;
			if (el) {
				el.focus();
				el.select();
			}
		});
		// Install document listener to catch taps outside the input
		if (!docListener) {
			docListener = (e: PointerEvent) => {
				if (e.pointerType === 'mouse') return;
				const input = cellInputRef.value;
				if (input && !input.contains(e.target as Node)) {
					input.blur(); // triggers commitCellEdit via @blur
				}
			};
			document.addEventListener('pointerdown', docListener, true);
		}
	} else {
		// Clean up document listener when editing ends
		if (docListener) {
			document.removeEventListener('pointerdown', docListener, true);
			docListener = null;
		}
	}
});

onBeforeUnmount(() => {
	if (docListener) {
		document.removeEventListener('pointerdown', docListener, true);
		docListener = null;
	}
});
</script>

<template>
	<div
		v-if="tableData"
		class="pptx-vue-element pptx-vue-table"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<TableResizeOverlay
			:column-widths="tableData.columnWidths"
			:editable="editingEnabled"
			@resize-columns="onResizeColumns"
			@resize-row="onResizeRow"
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
							:class="{
								'pptx-vue-table__cell--selected': cellSelection.isCellSelected(
									cell.rowIndex,
									cell.colIndex,
								),
								'pptx-vue-table__cell--in-selection':
									cellSelection.isCellInSelection(cell.rowIndex, cell.colIndex) &&
									!cellSelection.isCellSelected(cell.rowIndex, cell.colIndex),
								'pptx-vue-table__cell--editable': editingEnabled,
							}"
							:colspan="cell.colSpan"
							:rowspan="cell.rowSpan"
							:style="tdStyle(cell)"
							@pointerdown="onCellPointerDown($event, cell)"
							@click="onCellClick($event, cell)"
							@dblclick="onCellDblClick($event, cell)"
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
							Inline cell editor: a double-tap / double-click enters edit
							mode (edit context provided). The input MUST stop propagation
							of pointerdown/mousedown/click/dblclick so that on touch the
							canvas stage's pointer handler does not steal focus and discard
							the edit (mirrors React TableCellInput + Angular TableRenderer).
						-->
							<input
								v-if="isEditing(cell)"
								:ref="setCellInput"
								v-model="editText"
								type="text"
								class="pptx-vue-table__cell-input"
								@pointerdown.stop
								@mousedown.stop
								@click.stop
								@dblclick.stop
								@blur="commitCellEdit"
								@keydown="onCellInputKeydown"
							/>
							<!--
							Rich per-run text: when `textRuns` is present each run is
							a styled <span>. Paragraph breaks become block-level <div>s;
							line breaks become <br> within a paragraph.
						-->
							<template v-else-if="cell.textRuns">
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
		</TableResizeOverlay>
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

.pptx-vue-table__cell--editable {
	cursor: cell;
}

.pptx-vue-table__cell--selected {
	outline: 2px solid rgb(59 130 246);
	outline-offset: -2px;
}

.pptx-vue-table__cell--in-selection {
	background-color: rgba(59, 130, 246, 0.15);
	outline: 1px solid rgba(96, 165, 250, 0.5);
	outline-offset: -1px;
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

.pptx-vue-table__cell-input {
	width: 100%;
	margin: 0;
	padding: 0;
	border: none;
	background: transparent;
	color: inherit;
	font: inherit;
	outline: none;
}
</style>
