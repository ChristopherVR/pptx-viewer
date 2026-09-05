/**
 * table-style-editor.component.ts: "Edit style..." panel for a table style's
 * own DEFINITION (`a:tblStyleLst` section fill/text/borders/cell3D), distinct
 * from `TablePropertiesComponent`'s "which style does this table use" picker.
 * Angular port of React's `TableStyleEditor.tsx` / Vue's `TableStyleEditor.vue`.
 *
 * @module viewer/table-style-editor
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	normalizeTableStyleGuid,
} from 'pptx-viewer-core';

import type { TableStyleEditorFieldEdit, TableStyleEditorPartId } from '../internal/shared';
import {
	applyTableStyleFieldEdit,
	describeTableStyleEditor,
	TABLE_STYLE_EDITOR_PARTS,
} from '../internal/shared';
import { LoadContentService } from './load-content.service';
import { TableStyleEditorFieldsComponent } from './table-style-editor-fields.component';

@Component({
	selector: 'pptx-table-style-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, TableStyleEditorFieldsComponent],
	template: `
		<div class="pptx-tse" data-testid="table-style-editor">
			<div class="pptx-tse__hdr">
				<div class="pptx-tse__hdg">{{ 'pptx.tableStyleEditor.title' | translate }}</div>
				<button type="button" class="pptx-tse__btn" (click)="close.emit()">
					{{ 'pptx.tableStyleEditor.close' | translate }}
				</button>
			</div>

			@if (!entry()) {
				<div class="pptx-tse__empty">{{ 'pptx.tableStyleEditor.noStyleSelected' | translate }}</div>
			}

			@if (entry()) {
				<div class="pptx-tse__parts">
					@for (part of parts; track part.id) {
						<button
							type="button"
							class="pptx-tse__btn"
							[class.pptx-tse__btn--active]="selectedPart() === part.id"
							[disabled]="!canEdit()"
							(click)="selectedPart.set(part.id)"
						>
							{{ part.labelKey | translate }}
						</button>
					}
				</div>
			}

			@if (descriptor(); as d) {
				<pptx-table-style-editor-fields
					[descriptor]="d"
					[canEdit]="canEdit()"
					(edit)="onFieldEdit($event)"
				/>
			}

			<div class="pptx-tse__actions">
				<button
					type="button"
					class="pptx-tse__btn"
					[disabled]="!canEdit()"
					(click)="createFromCurrent()"
				>
					{{
						(entry() ? 'pptx.tableStyleEditor.newFromCurrent' : 'pptx.tableStyleEditor.newStyle')
							| translate
					}}
				</button>
				@if (entry()) {
					<button
						type="button"
						class="pptx-tse__btn"
						[disabled]="!canEdit()"
						(click)="handleDelete()"
					>
						{{ 'pptx.tableStyleEditor.deleteStyle' | translate }}
					</button>
				}
			</div>
		</div>
	`,
	styles: `
		.pptx-tse {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 4px;
			padding: 0.5rem;
		}
		.pptx-tse__hdr {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.pptx-tse__hdg {
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tse__empty {
			font-size: 11px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tse__parts {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}
		.pptx-tse__actions {
			display: flex;
			gap: 0.4rem;
			padding-top: 0.25rem;
			border-top: 1px solid var(--pptx-inspector-border, #444);
		}
		.pptx-tse__btn {
			font-size: 11px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 6px;
			cursor: pointer;
		}
		.pptx-tse__btn--active {
			background: var(--pptx-inspector-active, #3a3a3a);
		}
		.pptx-tse__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
	`,
})
export class TableStyleEditorComponent {
	readonly styleMap = input<ParsedTableStyleMap | undefined>(undefined);
	/** The style currently assigned to the table being edited. */
	readonly styleId = input<string | undefined>(undefined);
	readonly canEdit = input<boolean>(true);
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	readonly styleMapChange = output<ParsedTableStyleMap>();
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	readonly deleteStyle = output<string>();
	/** A newly-created style, for a parent that wants to assign it to the table. */
	readonly assignStyle = output<string>();
	readonly close = output<void>();

	private readonly translate = inject(TranslateService);
	private readonly loader = inject(LoadContentService, { optional: true });

	protected readonly parts = TABLE_STYLE_EDITOR_PARTS;
	protected readonly selectedPart = signal<TableStyleEditorPartId>('wholeTbl');
	private readonly activeStyleId = signal('');

	protected readonly entry = computed(() => {
		const id =
			this.activeStyleId() || (this.styleId() ? normalizeTableStyleGuid(this.styleId()!) : '');
		return id ? this.styleMap()?.[id] : undefined;
	});
	protected readonly descriptor = computed(() =>
		describeTableStyleEditor(this.entry(), this.selectedPart(), this.loader?.themeColorMap?.()),
	);

	protected onFieldEdit(fieldEdit: TableStyleEditorFieldEdit): void {
		const entry = this.entry();
		const map = this.styleMap();
		if (!entry || !map) {
			return;
		}
		const { entry: nextEntry } = applyTableStyleFieldEdit(entry, this.selectedPart(), fieldEdit);
		this.styleMapChange.emit({ ...map, [nextEntry.styleId]: nextEntry });
	}

	protected createFromCurrent(): void {
		const entry = this.entry();
		const name = window.prompt(
			this.translate.instant('pptx.tableStyleEditor.newStyleNamePrompt'),
			entry ? `${entry.styleName ?? ''} Copy`.trim() : '',
		);
		if (!name) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...(this.styleMap() ?? {}) };
		const created = createTableStyleEntry(nextMap, { styleName: name, basedOn: entry });
		addTableStyleToMap(nextMap, created);
		this.styleMapChange.emit(nextMap);
		this.activeStyleId.set(created.styleId);
		this.assignStyle.emit(created.styleId);
	}

	protected handleDelete(): void {
		const entry = this.entry();
		const map = this.styleMap();
		if (
			!entry ||
			!map ||
			!window.confirm(this.translate.instant('pptx.tableStyleEditor.deleteConfirm'))
		) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...map };
		deleteTableStyleFromMap(nextMap, entry.styleId);
		this.styleMapChange.emit(nextMap);
		this.deleteStyle.emit(entry.styleId);
		this.close.emit();
	}
}
