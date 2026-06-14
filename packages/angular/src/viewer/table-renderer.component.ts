import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { buildColStyles, buildTableViewModel } from './table-renderer-helpers';
import type { TableRowViewModel } from './table-renderer-helpers';

/**
 * TableRendererComponent — Angular port of the React `renderTableFromTableData`
 * (packages/react/src/viewer/utils/table-render-data.tsx).
 *
 * Renders a `<table>` from the typed `PptxTableData` structure that the core
 * parser populates on every `TablePptxElement`. This is the viewer-first path:
 * editing, resize overlays, and inline cell input are not yet ported.
 *
 * Key behaviours:
 *  - Merged cells: cells with `hMerge`/`vMerge` are skipped; the origin cell
 *    receives `[attr.colspan]`/`[attr.rowspan]` from `gridSpan`/`rowSpan`.
 *  - Column widths: a `<colgroup>` drives proportional widths from
 *    `PptxTableData.columnWidths` (0–1 fractions).
 *  - Row heights: `[ngStyle]` on `<tr>` sets an explicit pixel height when
 *    `PptxTableRow.height` is present.
 *  - Cell fill: solid `backgroundColor` or the parser's pre-built
 *    `gradientFillCss` string (gradient). Pattern fills are deferred.
 *  - Cell borders: per-edge (top/bottom/left/right) width + colour.
 *  - Cell text: plain `cell.text` string; rich text segments are a TODO.
 *
 * Pure helpers (view-model projection, style maps) live in
 * `table-renderer-helpers.ts` so tests can exercise them without TestBed.
 */
@Component({
	selector: 'pptx-table-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div class="pptx-ng-table-wrapper">
			<table class="pptx-ng-table">
				@if (colStyles().length > 0) {
					<colgroup>
						@for (colStyle of colStyles(); track $index) {
							<col [ngStyle]="colStyle" />
						}
					</colgroup>
				}
				<tbody>
					@for (row of rows(); track $index) {
						<tr [ngStyle]="row.rowStyle">
							@for (vm of row.cells; track $index) {
								<td
									[ngStyle]="vm.tdStyle"
									[attr.colspan]="vm.colSpan ?? null"
									[attr.rowspan]="vm.rowSpan ?? null"
								>
									{{ vm.displayText }}
								</td>
							}
						</tr>
					}
				</tbody>
			</table>
		</div>
	`,
})
export class TableRendererComponent {
	/** The table element to render. Must be `type === 'table'`. */
	readonly element = input.required<PptxElement>();

	/** Pre-computed `<col>` styles for the colgroup. */
	readonly colStyles = computed<StyleMap[]>(() => buildColStyles(this.element()));

	/** Projected view-model rows with merged-cell resolution applied. */
	readonly rows = computed<TableRowViewModel[]>(() => buildTableViewModel(this.element()));
}
