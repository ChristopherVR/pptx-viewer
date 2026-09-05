/**
 * table-style-editor-launcher.component.ts: the "Edit style..." button +
 * open/close state for `TableStyleEditorComponent`, extracted so
 * `TablePropertiesComponent` (already over this repo's 300-LOC file budget)
 * gains only a single wiring line rather than growing further.
 *
 * @module viewer/table-style-editor-launcher
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ParsedTableStyleMap } from 'pptx-viewer-core';

import { TableStyleEditorComponent } from './table-style-editor.component';

@Component({
	selector: 'pptx-table-style-editor-launcher',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, TableStyleEditorComponent],
	template: `
		@if (tableStyleMap() !== undefined) {
			<button
				type="button"
				class="pptx-tsel__btn"
				[disabled]="!canEdit()"
				(click)="open.set(!open())"
			>
				{{ 'pptx.tableStyleEditor.editButton' | translate }}
			</button>

			@if (open()) {
				<pptx-table-style-editor
					[styleMap]="tableStyleMap()"
					[styleId]="styleId()"
					[canEdit]="canEdit()"
					(styleMapChange)="tableStyleMapChange.emit($event)"
					(deleteStyle)="deleteTableStyle.emit($event)"
					(assignStyle)="assignStyle.emit($event)"
					(close)="open.set(false)"
				/>
			}
		}
	`,
	styles: `
		.pptx-tsel__btn {
			margin-top: 0.35rem;
			align-self: flex-start;
			font-size: 11px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 6px;
			cursor: pointer;
		}
		.pptx-tsel__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
	`,
})
export class TableStyleEditorLauncherComponent {
	readonly tableStyleMap = input<ParsedTableStyleMap | undefined>(undefined);
	readonly styleId = input<string | undefined>(undefined);
	readonly canEdit = input<boolean>(true);
	readonly tableStyleMapChange = output<ParsedTableStyleMap>();
	readonly deleteTableStyle = output<string>();
	/** A newly-created style, for a parent that wants to assign it to the table. */
	readonly assignStyle = output<string>();

	protected readonly open = signal(false);
}
