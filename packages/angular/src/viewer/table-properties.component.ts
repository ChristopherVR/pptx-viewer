/**
 * table-properties.component.ts: table-level style inspector.
 *
 * Selector: `pptx-table-properties`
 *
 * Angular port of the React `TablePropertiesPanel` (structure section only; the
 * per-cell formatting lives in `pptx-table-cell-formatting`). Exposes the
 * banding / header / first-last emphasis toggles + band cycles, the quick-style
 * preset swatches (`TABLE_STYLE_PRESETS`), and column-width / row-height
 * controls. Every edit emits a fully-updated element through `elementChange`,
 * committed by the inspector as one undoable history entry.
 */
/* oxlint-disable eslint/one-var -- each handler declares its own independent
   locals; merging them into one statement would hurt readability. */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ParsedTableStyleMap, PptxTableData, TablePptxElement } from 'pptx-viewer-core';

import type { TableStylePreset } from '../internal/shared';
import {
	applyTableStylePreset,
	evenColumnWidths,
	evenRowHeights,
	redistributeColumnWidth,
	TABLE_STYLE_PRESETS,
	tableStyleAssignmentUpdate,
} from '../internal/shared';
import { patchTableData } from './table-data-helpers';
import type { TableBooleanFlag } from './table-properties-helpers';
import { DEFAULT_TABLE_ROW_HEIGHT, TABLE_STRUCTURE_TOGGLES } from './table-properties-helpers';
import { TableStyleEditorLauncherComponent } from './table-style-editor-launcher.component';

@Component({
	selector: 'pptx-table-properties',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, TableStyleEditorLauncherComponent],
	template: `
		@if (td(); as data) {
			<div class="pptx-tp">
				<div class="pptx-tp__dims">{{ data.rows.length }} rows × {{ colCount() }} cols</div>

				<div class="pptx-tp__toggles">
					@for (toggle of toggles; track toggle.key) {
						<label class="pptx-tp__check">
							<input
								type="checkbox"
								[disabled]="!canEdit()"
								[checked]="!!data[toggle.key]"
								(change)="onToggle(toggle.key, $event)"
							/>
							<span>{{ toggle.labelKey | translate }}</span>
						</label>
					}
				</div>

				@if (data.bandedRows) {
					<label class="pptx-tp__field">
						<span class="pptx-tp__lbl">{{ 'pptx.table.bandRowCycle' | translate }}</span>
						<input
							type="number"
							class="pptx-tp__num"
							min="1"
							max="99"
							[disabled]="!canEdit()"
							[value]="data.bandRowCycle ?? 1"
							(change)="onCycle('bandRowCycle', $event)"
						/>
					</label>
				}
				@if (data.bandedColumns) {
					<label class="pptx-tp__field">
						<span class="pptx-tp__lbl">{{ 'pptx.table.bandColCycle' | translate }}</span>
						<input
							type="number"
							class="pptx-tp__num"
							min="1"
							max="99"
							[disabled]="!canEdit()"
							[value]="data.bandColCycle ?? 1"
							(change)="onCycle('bandColCycle', $event)"
						/>
					</label>
				}

				<span class="pptx-tp__lbl">{{ 'pptx.table.stylePresets' | translate }}</span>
				<div class="pptx-tp__presets">
					@for (preset of presets; track preset.id) {
						<button
							type="button"
							class="pptx-tp__preset"
							[disabled]="!canEdit()"
							[title]="preset.label"
							(click)="onPreset(preset)"
						>
							<span class="pptx-tp__swatch" [style.background]="preset.headerBg"></span>
							<span class="pptx-tp__swatch" [style.background]="preset.bandBg"></span>
							<span class="pptx-tp__swatch" [style.background]="preset.borderColor"></span>
						</button>
					}
				</div>
				<pptx-table-style-editor-launcher
					[tableStyleMap]="tableStyleMap()"
					[styleId]="data.tableStyleId"
					[canEdit]="canEdit()"
					(tableStyleMapChange)="tableStyleMapChange.emit($event)"
					(deleteTableStyle)="deleteTableStyle.emit($event)"
					(assignStyle)="onAssignStyle($event)"
				/>

				<div class="pptx-tp__row-head">
					<span class="pptx-tp__lbl">{{ 'pptx.table.columnWidths' | translate }}</span>
					<button
						type="button"
						class="pptx-tp__even"
						[disabled]="!canEdit()"
						(click)="onEvenCols()"
					>
						{{ 'pptx.table.even' | translate }}
					</button>
				</div>
				@for (w of data.columnWidths; track $index; let ci = $index) {
					<label class="pptx-tp__field">
						<span class="pptx-tp__idx">{{ ci + 1 }}</span>
						<input
							type="range"
							class="pptx-tp__range"
							min="5"
							max="80"
							[disabled]="!canEdit()"
							[value]="pct(w)"
							(input)="onColWidth(ci, $event)"
						/>
						<span class="pptx-tp__pct">{{ pct(w) }}%</span>
					</label>
				}

				<div class="pptx-tp__row-head">
					<span class="pptx-tp__lbl">{{ 'pptx.table.rowHeights' | translate }}</span>
					<button
						type="button"
						class="pptx-tp__even"
						[disabled]="!canEdit()"
						(click)="onEvenRows()"
					>
						{{ 'pptx.table.even' | translate }}
					</button>
				</div>
				@for (row of data.rows; track $index; let ri = $index) {
					<label class="pptx-tp__field">
						<span class="pptx-tp__idx">{{ ri + 1 }}</span>
						<input
							type="number"
							class="pptx-tp__num"
							min="16"
							max="500"
							[disabled]="!canEdit()"
							[value]="row.height ?? defaultRowHeight"
							(change)="onRowHeight(ri, $event)"
						/>
						<span class="pptx-tp__lbl">px</span>
					</label>
				}
			</div>
		}
	`,
	styles: `
		.pptx-tp {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
		}
		.pptx-tp__dims {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tp__toggles {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}
		.pptx-tp__check {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			font-size: 11px;
			cursor: pointer;
		}
		.pptx-tp__field {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			font-size: 11px;
		}
		.pptx-tp__row-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.pptx-tp__lbl {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tp__idx {
			width: 1.2rem;
			text-align: right;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tp__num {
			width: 3.5rem;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 11px;
		}
		.pptx-tp__range {
			flex: 1;
			min-width: 0;
		}
		.pptx-tp__pct {
			width: 2.5rem;
			text-align: right;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tp__even {
			font-size: 10px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 1px 6px;
			cursor: pointer;
		}
		.pptx-tp__presets {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0.3rem;
		}
		.pptx-tp__preset {
			display: flex;
			flex-direction: column;
			height: 2.5rem;
			padding: 0;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			overflow: hidden;
			cursor: pointer;
		}
		.pptx-tp__preset:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
		.pptx-tp__swatch {
			flex: 1;
			display: block;
		}
	`,
})
export class TablePropertiesComponent {
	/** The table element being edited. */
	readonly element = input.required<TablePptxElement>();
	/** Whether editing is enabled. */
	readonly canEdit = input<boolean>(true);
	/** Emits the fully-updated element after any edit. */
	readonly elementChange = output<TablePptxElement>();
	/**
	 * The deck's parsed `ppt/tableStyles.xml` map, for "Edit style...". `undefined`
	 * means the host has not wired the table-style-editor feature through; the
	 * launcher then simply does not render its button.
	 */
	readonly tableStyleMap = input<ParsedTableStyleMap | undefined>(undefined);
	readonly tableStyleMapChange = output<ParsedTableStyleMap>();
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	readonly deleteTableStyle = output<string>();

	protected readonly toggles = TABLE_STRUCTURE_TOGGLES;
	protected readonly presets = TABLE_STYLE_PRESETS;
	protected readonly defaultRowHeight = DEFAULT_TABLE_ROW_HEIGHT;

	protected readonly td = computed(() => this.element().tableData);
	protected readonly colCount = computed(() => this.td()?.columnWidths.length ?? 0);

	protected pct(fraction: number): number {
		return Math.round(fraction * 100);
	}

	protected onToggle(key: TableBooleanFlag, event: Event): void {
		const t = event.target;
		if (t instanceof HTMLInputElement) {
			this.emit({ [key]: t.checked });
		}
	}

	protected onCycle(key: 'bandRowCycle' | 'bandColCycle', event: Event): void {
		const n = numberFrom(event);
		if (n !== null) {
			this.emit({ [key]: Math.max(1, Math.round(n)) });
		}
	}

	protected onPreset(preset: TableStylePreset): void {
		const data = this.td();
		if (!data) {
			return;
		}
		this.emit({ rows: applyTableStylePreset(data, preset) });
	}

	protected onEvenCols(): void {
		this.emit({ columnWidths: evenColumnWidths(this.colCount()) });
	}

	protected onEvenRows(): void {
		const data = this.td();
		if (data) {
			this.emit({ rows: evenRowHeights(data.rows) });
		}
	}

	protected onColWidth(index: number, event: Event): void {
		const data = this.td();
		const n = numberFrom(event);
		if (!data || n === null) {
			return;
		}
		this.emit({ columnWidths: redistributeColumnWidth(data.columnWidths, index, n / 100) });
	}

	protected onRowHeight(index: number, event: Event): void {
		const data = this.td();
		const n = numberFrom(event);
		if (!data || n === null) {
			return;
		}
		const rows = data.rows.map((r, i) => (i === index ? { ...r, height: n } : r));
		this.emit({ rows });
	}

	/** A newly-created style (from "Edit style...") becomes this table's style. */
	protected onAssignStyle(styleId: string): void {
		this.emit(tableStyleAssignmentUpdate(styleId));
	}

	private emit(patch: Partial<PptxTableData>): void {
		this.elementChange.emit(patchTableData(this.element(), patch));
	}
}

function numberFrom(event: Event): number | null {
	const t = event.target;
	if (!(t instanceof HTMLInputElement)) {
		return null;
	}
	const n = Number(t.value);
	return Number.isFinite(n) ? n : null;
}
