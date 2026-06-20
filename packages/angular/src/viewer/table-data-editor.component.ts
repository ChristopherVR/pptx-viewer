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

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { TablePptxElement } from 'pptx-viewer-core';

import {
	addTableColumn,
	addTableRow,
	removeTableColumn,
	removeTableRow,
	setCellText,
} from './table-data-helpers';

@Component({
	selector: 'pptx-table-data-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="pptx-tbl-editor" aria-label="Table data editor">
			<header class="pptx-tbl-editor__header">
				<h3 class="pptx-tbl-editor__heading">Table Data</h3>

				@if (canEdit()) {
					<div class="pptx-tbl-editor__actions">
						<!-- Row add/remove -->
						<button
							type="button"
							class="pptx-tbl-editor__btn"
							title="Add row below last"
							(click)="onAddRow()"
						>
							+ Row
						</button>
						<button
							type="button"
							class="pptx-tbl-editor__btn pptx-tbl-editor__btn--danger"
							[disabled]="rowCount() <= 1"
							title="Remove last row"
							(click)="onRemoveLastRow()"
						>
							- Row
						</button>
						<!-- Column add/remove -->
						<button
							type="button"
							class="pptx-tbl-editor__btn"
							title="Add column to the right"
							(click)="onAddColumn()"
						>
							+ Col
						</button>
						<button
							type="button"
							class="pptx-tbl-editor__btn pptx-tbl-editor__btn--danger"
							[disabled]="colCount() <= 1"
							title="Remove last column"
							(click)="onRemoveLastColumn()"
						>
							- Col
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
								@if (canEdit() && colCount() > 1) {
									<button
										type="button"
										class="pptx-tbl-editor__remove-btn"
										title="Remove column {{ colIdx + 1 }}"
										(click)="onRemoveColumn(colIdx)"
									>
										×
									</button>
								}
							</div>
						}
					</div>
					@for (row of rows(); track $index; let ri = $index) {
						<div class="pptx-tbl-editor__row" role="row">
							<!-- Row label + remove button -->
							<div class="pptx-tbl-editor__row-header" role="rowheader">
								<span class="pptx-tbl-editor__row-label">{{ ri + 1 }}</span>
								@if (canEdit() && rowCount() > 1) {
									<button
										type="button"
										class="pptx-tbl-editor__remove-btn"
										title="Remove row {{ ri + 1 }}"
										(click)="onRemoveRow(ri)"
									>
										×
									</button>
								}
							</div>
							@for (cell of row.cells; track $index; let ci = $index) {
								<div class="pptx-tbl-editor__cell" role="gridcell">
									<input
										type="text"
										class="pptx-tbl-editor__input"
										[disabled]="!canEdit()"
										[value]="cell.text"
										(change)="onCellChange($event, ri, ci)"
									/>
								</div>
							}
						</div>
					}
				</div>
			</div>
		</section>
	`,
	styles: `
		.pptx-tbl-editor {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			padding: 0.5rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-tbl-editor__header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.35rem;
		}

		.pptx-tbl-editor__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0;
		}

		.pptx-tbl-editor__actions {
			display: flex;
			gap: 0.2rem;
			flex-wrap: wrap;
		}

		.pptx-tbl-editor__btn {
			padding: 2px 5px;
			font-size: 10px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			white-space: nowrap;
		}

		.pptx-tbl-editor__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-tbl-editor__btn--danger {
			color: var(--pptx-inspector-danger, #f47c7c);
			border-color: var(--pptx-inspector-danger-border, #6b2a2a);
		}

		.pptx-tbl-editor__scroll {
			overflow-x: auto;
		}

		.pptx-tbl-editor__grid {
			display: flex;
			flex-direction: column;
			font-size: 11px;
			min-width: 100%;
			width: max-content;
		}

		.pptx-tbl-editor__row {
			display: flex;
		}

		.pptx-tbl-editor__corner,
		.pptx-tbl-editor__col-header,
		.pptx-tbl-editor__row-header {
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: var(--pptx-inspector-muted, #888);
			font-weight: 400;
			padding: 2px 4px;
			border: 1px solid var(--pptx-inspector-border, #333);
			margin: -0.5px;
			white-space: nowrap;
		}

		.pptx-tbl-editor__col-header {
			flex: 1 0 60px;
		}

		.pptx-tbl-editor__corner,
		.pptx-tbl-editor__row-header {
			flex: 0 0 40px;
		}

		.pptx-tbl-editor__col-label,
		.pptx-tbl-editor__row-label {
			margin-right: 2px;
		}

		.pptx-tbl-editor__remove-btn {
			padding: 0 2px;
			font-size: 11px;
			line-height: 1;
			background: none;
			border: none;
			color: var(--pptx-inspector-danger, #f47c7c);
			cursor: pointer;
		}

		.pptx-tbl-editor__cell {
			display: flex;
			flex: 1 0 60px;
			padding: 1px;
			border: 1px solid var(--pptx-inspector-border, #333);
			margin: -0.5px;
		}

		.pptx-tbl-editor__input {
			width: 100%;
			box-sizing: border-box;
			padding: 2px 4px;
			font-size: 11px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			border: none;
			outline: none;
		}

		.pptx-tbl-editor__input:focus {
			background: var(--pptx-inspector-active-bg, #1a3a5c);
		}

		.pptx-tbl-editor__input:disabled {
			opacity: 0.6;
		}
	`,
})
export class TableDataEditorComponent {
	/** The table element being edited. */
	readonly element = input.required<TablePptxElement>();
	/** Whether editing is enabled (read-only mode when false). */
	readonly canEdit = input<boolean>(true);

	/** Emits the updated element after any edit operation. */
	readonly elementChange = output<TablePptxElement>();

	// ── Computed helpers ────────────────────────────────────────────────────

	protected readonly rows = computed(() => this.element().tableData?.rows ?? []);
	protected readonly rowCount = computed(() => this.rows().length);
	protected readonly colCount = computed(() => this.element().tableData?.columnWidths.length ?? 0);
	protected readonly colIndices = computed(() =>
		Array.from({ length: this.colCount() }, (_, i) => i),
	);

	// ── Event handlers ──────────────────────────────────────────────────────

	protected onCellChange(event: Event, rowIndex: number, colIndex: number): void {
		const text = stringFromEvent(event);
		if (text === null) {
			return;
		}
		this.elementChange.emit(setCellText(this.element(), rowIndex, colIndex, text));
	}

	protected onAddRow(): void {
		const last = this.rowCount() - 1;
		this.elementChange.emit(addTableRow(this.element(), last));
	}

	protected onRemoveLastRow(): void {
		const last = this.rowCount() - 1;
		if (last < 0) {
			return;
		}
		this.elementChange.emit(removeTableRow(this.element(), last));
	}

	protected onRemoveRow(rowIndex: number): void {
		this.elementChange.emit(removeTableRow(this.element(), rowIndex));
	}

	protected onAddColumn(): void {
		const last = this.colCount() - 1;
		this.elementChange.emit(addTableColumn(this.element(), last));
	}

	protected onRemoveLastColumn(): void {
		const last = this.colCount() - 1;
		if (last < 0) {
			return;
		}
		this.elementChange.emit(removeTableColumn(this.element(), last));
	}

	protected onRemoveColumn(colIndex: number): void {
		this.elementChange.emit(removeTableColumn(this.element(), colIndex));
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
