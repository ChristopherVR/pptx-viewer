import { NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	Injector,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { buildColStyles, buildTableViewModel } from './table-renderer-helpers';
import type { CellParagraph, TableRowViewModel } from './table-renderer-helpers';

/** A committed table-cell text edit (original grid coordinates + new text). */
export interface TableCellCommit {
	rowIndex: number;
	colIndex: number;
	text: string;
}

/** The cell currently being edited (original grid coordinates), or null. */
interface EditingCell {
	rowIndex: number;
	colIndex: number;
}

/**
 * TableRendererComponent: Angular port of the React `renderTableFromTableData`
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
 *  - Cell text: rich-text paragraphs of styled `<span>` runs when the cell
 *    carries text or formatting; falls back to a non-breaking-space placeholder
 *    for empty+unstyled cells (preserves row height).
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
									(dblclick)="onCellDblClick($event, vm.rowIndex, vm.colIndex)"
								>
									@if (isEditing(vm.rowIndex, vm.colIndex)) {
										<input
											#cellInput
											type="text"
											class="pptx-ng-cell-input"
											[value]="vm.cell.text ?? ''"
											(pointerdown)="$event.stopPropagation()"
											(mousedown)="$event.stopPropagation()"
											(click)="$event.stopPropagation()"
											(dblclick)="$event.stopPropagation()"
											(blur)="commitCellEdit($event)"
											(keydown)="onCellInputKeydown($event)"
										/>
									} @else if (vm.paragraphs.length > 0) {
										@for (para of vm.paragraphs; track $index) {
											<p class="pptx-ng-cell-para">
												@for (run of para; track $index) {
													@if (run.isLineBreak) {
														<br />
													} @else {
														<span [ngStyle]="run.style">{{ run.text }}</span>
													}
												}
											</p>
										}
									} @else {
										{{ vm.displayText }}
									}
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
	private readonly injector = inject(Injector);

	/** The table element to render. Must be `type === 'table'`. */
	readonly element = input.required<PptxElement>();

	/** Whether inline cell editing (double-tap → text input) is enabled. */
	readonly editable = input<boolean>(false);

	/** Emitted when a cell edit is committed (Enter / blur). */
	readonly cellCommit = output<TableCellCommit>();

	/** The cell currently being edited (original grid coords), or null. */
	private readonly editingCell = signal<EditingCell | null>(null);

	/** The mounted `<input>` for the active cell edit, if any. */
	private readonly cellInput = viewChild<ElementRef<HTMLInputElement>>('cellInput');

	/** Pre-computed `<col>` styles for the colgroup. */
	readonly colStyles = computed<StyleMap[]>(() => buildColStyles(this.element()));

	/** Projected view-model rows with merged-cell resolution applied. */
	readonly rows = computed<TableRowViewModel[]>(() => buildTableViewModel(this.element()));

	constructor() {
		// Focus + select-all the cell input as soon as it mounts (mirrors React's
		// TableCellInput useEffect: focus(); select();). Runs whenever the edited
		// cell changes.
		effect(() => {
			if (this.editingCell()) {
				afterNextRender(
					() => {
						const el = this.cellInput()?.nativeElement;
						if (el) {
							el.focus();
							el.select();
						}
					},
					{ injector: this.injector },
				);
			}
		});
	}

	/** True when the given cell (original grid coords) is being edited. */
	isEditing(rowIndex: number, colIndex: number): boolean {
		const e = this.editingCell();
		return e !== null && e.rowIndex === rowIndex && e.colIndex === colIndex;
	}

	/** Double-tap / double-click on a cell enters inline edit mode. */
	onCellDblClick(event: Event, rowIndex: number, colIndex: number): void {
		if (!this.editable()) {
			return;
		}
		event.stopPropagation();
		this.editingCell.set({ rowIndex, colIndex });
	}

	/** Commit the current edit (called on blur). */
	commitCellEdit(event: Event): void {
		const cell = this.editingCell();
		if (!cell) {
			return;
		}
		const value = (event.target as HTMLInputElement).value;
		this.editingCell.set(null);
		this.cellCommit.emit({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, text: value });
	}

	/** Enter commits, Escape cancels. Stops propagation so the canvas ignores it. */
	onCellInputKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			// Commit via blur so the single commit path runs once.
			(event.target as HTMLInputElement).blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.editingCell.set(null);
		}
	}
}

// Re-export for template type-checking (CellParagraph is used in the @for loop).
export type { CellParagraph };
