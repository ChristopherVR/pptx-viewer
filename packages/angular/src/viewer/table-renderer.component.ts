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
import type { PptxElement, PptxTableData, TablePptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { buildColStyles, buildTableViewModel } from './table-renderer-helpers';
import type { CellParagraph, TableRowViewModel } from './table-renderer-helpers';
import { TableResizeOverlayComponent } from './table-resize-overlay.component';
import { TableSelectionService } from './table-selection.service';

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
 * (packages/react/src/viewer/utils/table-render-data.tsx) plus the editor
 * overlays (`table-render.tsx` selection, `table-render-resize.tsx` handles).
 *
 * Renders a `<table>` from the typed `PptxTableData` structure. Behaviours:
 *  - Merged cells resolve to `colspan`/`rowspan`; banding is baked into the
 *    per-cell style; diagonal borders render as an SVG overlay.
 *  - Editing (when `editable`): single click selects a cell, Shift+Click extends
 *    a rectangular range (both via {@link TableSelectionService}, shared with the
 *    inspector), double click opens an inline text input, and drag handles on the
 *    column / row boundaries resize the table (emitted through `tableChange`).
 *
 * Pure helpers live in `table-renderer-helpers.ts` / `table-cell-style.ts`.
 */
@Component({
	selector: 'pptx-table-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TableResizeOverlayComponent],
	template: `
		<pptx-table-resize-overlay
			[columnWidths]="columnWidths()"
			[editable]="editable()"
			(resizeColumns)="onResizeColumns($event)"
			(resizeRow)="onResizeRow($event)"
		>
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
										class="pptx-ng-cell"
										[class.is-selected]="isSelectedAnchor(vm.rowIndex, vm.colIndex)"
										[class.is-in-range]="isInRange(vm.rowIndex, vm.colIndex)"
										[class.is-editable]="editable()"
										[ngStyle]="vm.tdStyle"
										[attr.colspan]="vm.colSpan ?? null"
										[attr.rowspan]="vm.rowSpan ?? null"
										(click)="onCellClick($event, vm.rowIndex, vm.colIndex)"
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
										@if (vm.diagonal; as diag) {
											<svg class="pptx-ng-cell-diag" aria-hidden="true">
												@if (diag.diagDownColor && diag.diagDownWidth) {
													<line
														x1="0"
														y1="0"
														x2="100%"
														y2="100%"
														[attr.stroke]="diag.diagDownColor"
														[attr.stroke-width]="diag.diagDownWidth"
													/>
												}
												@if (diag.diagUpColor && diag.diagUpWidth) {
													<line
														x1="0"
														y1="100%"
														x2="100%"
														y2="0"
														[attr.stroke]="diag.diagUpColor"
														[attr.stroke-width]="diag.diagUpWidth"
													/>
												}
											</svg>
										}
									</td>
								}
							</tr>
						}
					</tbody>
				</table>
			</div>
		</pptx-table-resize-overlay>
	`,
	styles: `
		.pptx-ng-cell {
			position: relative;
		}
		.pptx-ng-cell.is-editable {
			cursor: cell;
		}
		.pptx-ng-cell.is-selected {
			outline: 2px solid rgba(59, 130, 246, 0.9);
			outline-offset: -2px;
		}
		.pptx-ng-cell.is-in-range {
			background-color: rgba(59, 130, 246, 0.15);
			outline: 1px solid rgba(96, 165, 250, 0.5);
			outline-offset: -1px;
		}
		.pptx-ng-cell-diag {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			overflow: visible;
		}
	`,
})
export class TableRendererComponent {
	private readonly injector = inject(Injector);
	/** Shared cell-selection state (present only inside the editor subtree). */
	private readonly selectionSvc = inject(TableSelectionService, { optional: true });

	/** The table element to render. Must be `type === 'table'`. */
	readonly element = input.required<PptxElement>();

	/** Whether inline cell editing / selection / resize is enabled. */
	readonly editable = input<boolean>(false);

	/** Emitted when a cell edit is committed (Enter / blur). */
	readonly cellCommit = output<TableCellCommit>();

	/** Emitted when a structural table change (resize) should be persisted. */
	readonly tableChange = output<{ id: string; tableData: PptxTableData }>();

	/** The cell currently being edited (original grid coords), or null. */
	private readonly editingCell = signal<EditingCell | null>(null);

	/** The mounted `<input>` for the active cell edit, if any. */
	private readonly cellInput = viewChild<ElementRef<HTMLInputElement>>('cellInput');

	/** Pre-computed `<col>` styles for the colgroup. */
	readonly colStyles = computed<StyleMap[]>(() => buildColStyles(this.element()));

	/** Projected view-model rows with merged-cell resolution + banding applied. */
	readonly rows = computed<TableRowViewModel[]>(() => buildTableViewModel(this.element()));

	/** Column widths (0-1 fractions) for the resize overlay. */
	readonly columnWidths = computed<number[]>(() => this.tableData()?.columnWidths ?? []);

	constructor() {
		// Focus + select-all the cell input as soon as it mounts (mirrors React's
		// TableCellInput useEffect). Runs whenever the edited cell changes.
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

	private tableData(): PptxTableData | undefined {
		const el = this.element();
		return el.type === 'table' ? (el as TablePptxElement).tableData : undefined;
	}

	/** True when the given cell (original grid coords) is being edited. */
	isEditing(rowIndex: number, colIndex: number): boolean {
		const e = this.editingCell();
		return e !== null && e.rowIndex === rowIndex && e.colIndex === colIndex;
	}

	/** True when the cell is the current selection anchor for this element. */
	isSelectedAnchor(rowIndex: number, colIndex: number): boolean {
		const sel = this.selectionSvc?.selection();
		return (
			Boolean(sel) &&
			sel?.elementId === this.element().id &&
			sel?.rowIndex === rowIndex &&
			sel?.columnIndex === colIndex
		);
	}

	/** True when the cell falls inside the active Shift+Click range. */
	isInRange(rowIndex: number, colIndex: number): boolean {
		const sel = this.selectionSvc?.selection();
		if (!sel || sel.elementId !== this.element().id || !sel.selectedCells) {
			return false;
		}
		return sel.selectedCells.some((c) => c.row === rowIndex && c.col === colIndex);
	}

	/** Single click selects the cell; Shift+Click extends a rectangular range. */
	onCellClick(event: MouseEvent, rowIndex: number, colIndex: number): void {
		if (!this.editable() || !this.selectionSvc) {
			return;
		}
		event.stopPropagation();
		const id = this.element().id;
		const td = this.tableData();
		if (event.shiftKey && td) {
			this.selectionSvc.extendTo(id, rowIndex, colIndex, td);
		} else {
			this.selectionSvc.selectCell(id, rowIndex, colIndex);
		}
	}

	/** Double-click on a cell enters inline edit mode. */
	onCellDblClick(event: Event, rowIndex: number, colIndex: number): void {
		if (!this.editable()) {
			return;
		}
		event.stopPropagation();
		this.editingCell.set({ rowIndex, colIndex });
		this.selectionSvc?.beginEditing(this.element().id, rowIndex, colIndex);
	}

	/** Commit the current edit (called on blur). */
	commitCellEdit(event: Event): void {
		const cell = this.editingCell();
		if (!cell) {
			return;
		}
		const value = (event.target as HTMLInputElement).value;
		this.editingCell.set(null);
		this.selectionSvc?.endEditing();
		this.cellCommit.emit({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, text: value });
	}

	/** Enter/Tab commits, Escape cancels. Stops propagation so the canvas ignores it. */
	onCellInputKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			(event.target as HTMLInputElement).blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.editingCell.set(null);
			this.selectionSvc?.endEditing();
		}
	}

	/** Persist a column-width drag by emitting new table data. */
	onResizeColumns(newWidths: number[]): void {
		const td = this.tableData();
		if (!td) {
			return;
		}
		this.tableChange.emit({
			id: this.element().id,
			tableData: { ...td, columnWidths: newWidths },
		});
	}

	/** Persist a row-height drag by emitting new table data. */
	onResizeRow(event: { index: number; height: number }): void {
		const td = this.tableData();
		if (!td) {
			return;
		}
		const rows = td.rows.map((row, i) =>
			i === event.index ? { ...row, height: event.height } : row,
		);
		this.tableChange.emit({ id: this.element().id, tableData: { ...td, rows } });
	}
}

// Re-export for template type-checking (CellParagraph is used in the @for loop).
export type { CellParagraph };
