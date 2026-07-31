/**
 * table-data-editor.component.ts: Presentational table data editor panel.
 *
 * Selector: `pptx-table-data-editor`
 *
 * Renders a compact spreadsheet-like grid for editing table cell text plus
 * row/column add and remove buttons.  All mutations are performed by the
 * pure helpers in `table-data-helpers.ts` and emitted as a complete new
 * `TablePptxElement` via the `elementChange` output; no internal state is
 * kept.
 *
 * The parent (typically `InspectorPanelComponent`) receives the emitted
 * element and commits it to `EditorStateService.updateElement()` as a single
 * history entry.
 *
 * Ported from the React inspector:
 *   packages/react/src/viewer/components/inspector/TablePropertiesPanel.tsx
 *
 * Usage:
 * ```html
 * <pptx-table-data-editor
 *   [element]="selectedElement"
 *   [canEdit]="canEdit"
 *   (elementChange)="onTableChange($event)"
 * />
 * ```
 *
 * @module angular-viewer/table-data-editor
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { TablePptxElement } from 'pptx-viewer-core';

import {
	appendTableElementColumn,
	appendTableElementRow,
	buildTableDataGrid,
	removeLastTableElementColumn,
	removeLastTableElementRow,
	setTableElementCellText,
} from '../internal/shared';
import { TABLE_DATA_EDITOR_STYLES } from './table-data-editor-styles';
import { removeColumn, removeRow } from './table-data-helpers';
import { TableSelectionService } from './table-selection.service';

@Component({
	selector: 'pptx-table-data-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section
			class="pptx-tbl-editor"
			[attr.aria-label]="'pptx.tableDataEditor.ariaLabel' | translate"
		>
			<header class="pptx-tbl-editor__header">
				<h3 class="pptx-tbl-editor__heading">{{ 'pptx.inspector.tableData' | translate }}</h3>

				@if (canEdit()) {
					<div class="pptx-tbl-editor__actions">
						<!-- Row add/remove -->
						<button
							type="button"
							class="pptx-tbl-editor__btn"
							[title]="'pptx.tableDataEditor.addRowTitle' | translate"
							(click)="onAddRow()"
						>
							{{ 'pptx.tableDataEditor.addRowLabel' | translate }}
						</button>
						<button
							type="button"
							class="pptx-tbl-editor__btn pptx-tbl-editor__btn--danger"
							[disabled]="!canRemoveRow()"
							[title]="'pptx.tableDataEditor.removeRowTitle' | translate"
							(click)="onRemoveLastRow()"
						>
							{{ 'pptx.tableDataEditor.removeRowLabel' | translate }}
						</button>
						<!-- Column add/remove -->
						<button
							type="button"
							class="pptx-tbl-editor__btn"
							[title]="'pptx.tableDataEditor.addColumnTitle' | translate"
							(click)="onAddColumn()"
						>
							{{ 'pptx.tableDataEditor.addColumnLabel' | translate }}
						</button>
						<button
							type="button"
							class="pptx-tbl-editor__btn pptx-tbl-editor__btn--danger"
							[disabled]="!canRemoveColumn()"
							[title]="'pptx.tableDataEditor.removeColumnTitle' | translate"
							(click)="onRemoveLastColumn()"
						>
							{{ 'pptx.tableDataEditor.removeColumnLabel' | translate }}
						</button>
					</div>
				}
			</header>

			<!-- A non-table grid (role=grid) on purpose: the framework-neutral e2e
			     contract uses a td-input selector for the in-slide table-cell
			     editor, so this inspector editor must NOT put its inputs inside td
			     cells or it collides (Playwright strict mode). -->
			<div class="pptx-tbl-editor__scroll">
				<div class="pptx-tbl-editor__grid" role="grid">
					<div class="pptx-tbl-editor__row" role="row">
						<!-- Row-number gutter -->
						<div class="pptx-tbl-editor__corner" role="columnheader"></div>
						@for (colIdx of colIndices(); track colIdx) {
							<div class="pptx-tbl-editor__col-header" role="columnheader">
								<span class="pptx-tbl-editor__col-label">{{ colIdx + 1 }}</span>
								@if (canEdit() && canRemoveColumn()) {
									<button
										type="button"
										class="pptx-tbl-editor__remove-btn"
										[attr.aria-label]="
											'pptx.tableDataEditor.removeColumnN' | translate: { number: colIdx + 1 }
										"
										[title]="
											'pptx.tableDataEditor.removeColumnN' | translate: { number: colIdx + 1 }
										"
										(click)="onRemoveColumn(colIdx)"
									>
										×
									</button>
								}
							</div>
						}
					</div>
					@for (row of rows(); track row.rowIndex) {
						<div class="pptx-tbl-editor__row" role="row">
							<!-- Row label + remove button -->
							<div class="pptx-tbl-editor__row-header" role="rowheader">
								<span class="pptx-tbl-editor__row-label">{{ row.rowIndex + 1 }}</span>
								@if (canEdit() && canRemoveRow()) {
									<button
										type="button"
										class="pptx-tbl-editor__remove-btn"
										[attr.aria-label]="
											'pptx.tableDataEditor.removeRowN' | translate: { number: row.rowIndex + 1 }
										"
										[title]="
											'pptx.tableDataEditor.removeRowN' | translate: { number: row.rowIndex + 1 }
										"
										(click)="onRemoveRow(row.rowIndex)"
									>
										×
									</button>
								}
							</div>
							@for (cell of row.cells; track cell.colIndex) {
								<div class="pptx-tbl-editor__cell" role="gridcell">
									<input
										type="text"
										class="pptx-tbl-editor__input"
										[disabled]="!canEdit()"
										[value]="cell.text"
										[attr.aria-label]="
											'pptx.tableDataEditor.cellAriaLabel'
												| translate: { row: cell.rowIndex + 1, column: cell.colIndex + 1 }
										"
										(focus)="onCellFocus(cell.rowIndex, cell.colIndex)"
										(change)="onCellChange($event, cell.rowIndex, cell.colIndex)"
									/>
								</div>
							}
						</div>
					}
				</div>
			</div>
		</section>
	`,
	styles: TABLE_DATA_EDITOR_STYLES,
})
export class TableDataEditorComponent {
	/** The table element being edited. */
	readonly element = input.required<TablePptxElement>();
	/** Whether editing is enabled (read-only mode when false). */
	readonly canEdit = input<boolean>(true);

	/** Emits the updated element after any edit operation. */
	readonly elementChange = output<TablePptxElement>();

	/** Shared cell selection (drives the cell-formatting panel + context menu). */
	private readonly selection = inject(TableSelectionService, { optional: true });

	// ── Computed helpers ────────────────────────────────────────────────────

	/**
	 * Normalised render model from `pptx-viewer-shared`. Using it (rather than
	 * iterating `tableData.rows` directly) is what keeps ragged rows, which real
	 * decks do contain, from rendering a lopsided grid with cells missing off the
	 * right-hand edge.
	 */
	protected readonly grid = computed(() => buildTableDataGrid(this.element()));

	protected readonly rows = computed(() => this.grid().rows);
	protected readonly rowCount = computed(() => this.grid().rowCount);
	protected readonly colCount = computed(() => this.grid().colCount);
	protected readonly colIndices = computed(() => this.grid().colIndices);
	protected readonly canRemoveRow = computed(() => this.grid().canRemoveRow);
	protected readonly canRemoveColumn = computed(() => this.grid().canRemoveColumn);

	// ── Event handlers ──────────────────────────────────────────────────────

	protected onCellChange(event: Event, rowIndex: number, colIndex: number): void {
		const text = stringFromEvent(event);
		if (text === null) {
			return;
		}
		this.elementChange.emit(setTableElementCellText(this.element(), rowIndex, colIndex, text));
	}

	/** Focusing a cell selects it so the cell-formatting panel targets it. */
	protected onCellFocus(rowIndex: number, colIndex: number): void {
		this.selection?.selectCell(this.element().id, rowIndex, colIndex);
	}

	protected onAddRow(): void {
		this.elementChange.emit(appendTableElementRow(this.element()));
	}

	protected onRemoveLastRow(): void {
		this.elementChange.emit(removeLastTableElementRow(this.element()));
	}

	protected onRemoveRow(rowIndex: number): void {
		this.elementChange.emit(removeRow(this.element(), rowIndex));
	}

	protected onAddColumn(): void {
		this.elementChange.emit(appendTableElementColumn(this.element()));
	}

	protected onRemoveLastColumn(): void {
		this.elementChange.emit(removeLastTableElementColumn(this.element()));
	}

	protected onRemoveColumn(colIndex: number): void {
		this.elementChange.emit(removeColumn(this.element(), colIndex));
	}
}

// ── Module-private helpers ───────────────────────────────────────────────────

/** Read the current string value from an `<input>` change event. */
function stringFromEvent(event: Event): string | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	return target.value;
}
