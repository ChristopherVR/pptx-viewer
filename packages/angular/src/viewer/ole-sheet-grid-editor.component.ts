/**
 * ole-sheet-grid-editor.component.ts: editable spreadsheet grid for the OLE
 * "Edit content" dialog's sheet tab.
 *
 * Selector: `pptx-ole-sheet-grid-editor`
 *
 * Extracted from `ole-editor-dialog.component.ts` to respect the 300-LOC
 * file-size limit, matching the split React took in `OleEditorDialogTabs.tsx`
 * (`OleSheetGridEditor`). One `<input>` per cell; a value is committed on
 * blur only when it actually changed, so a click-through without editing
 * never triggers a write.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { OleSheetGrid } from 'pptx-viewer-core';

/** One committed cell edit: `{row, col}` are the grid's own 0-based indices. */
export interface OleSheetCellEdit {
	row: number;
	col: number;
	value: string;
}

@Component({
	selector: 'pptx-ole-sheet-grid-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (!grid() || grid()!.rows.length === 0) {
			<p class="pptx-ole-edit-empty">{{ 'pptx.ole.editDialog.emptySheet' | translate }}</p>
		} @else {
			<div class="pptx-ole-edit-grid-wrap">
				<table class="pptx-ole-edit-grid">
					<tbody>
						@for (row of grid()!.rows; track $index; let rowIndex = $index) {
							<tr>
								@for (cell of row.cells; track $index; let colIndex = $index) {
									<td>
										<input
											type="text"
											[attr.aria-label]="'pptx.ole.editDialog.cellEditLabel' | translate"
											[value]="cell.value"
											(blur)="onBlur(rowIndex, colIndex, cell.value, $event)"
										/>
									</td>
								}
							</tr>
						}
					</tbody>
				</table>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ole-edit-empty {
				margin: 0;
				font-size: 11px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ole-edit-grid-wrap {
				max-height: 50vh;
				overflow: auto;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 4px;
			}
			.pptx-ole-edit-grid {
				width: 100%;
				border-collapse: collapse;
				font-size: 11px;
			}
			.pptx-ole-edit-grid td {
				padding: 0;
				border: 1px solid var(--pptx-border, #374151);
			}
			.pptx-ole-edit-grid input {
				width: 100%;
				box-sizing: border-box;
				padding: 4px 6px;
				border: none;
				background: transparent;
				color: inherit;
				font: inherit;
			}
			.pptx-ole-edit-grid input:focus {
				outline: none;
				background: var(--pptx-accent, rgba(99, 102, 241, 0.15));
			}
		`,
	],
})
export class OleSheetGridEditorComponent {
	/** The grid to render; `undefined` while still loading. */
	readonly grid = input<OleSheetGrid | undefined>(undefined);

	/** Fired when a cell's committed value differs from what was loaded. */
	readonly cellEdit = output<OleSheetCellEdit>();

	protected onBlur(row: number, col: number, original: string, event: Event): void {
		const value = (event.target as HTMLInputElement).value;
		if (value !== original) {
			this.cellEdit.emit({ row, col, value });
		}
	}
}
