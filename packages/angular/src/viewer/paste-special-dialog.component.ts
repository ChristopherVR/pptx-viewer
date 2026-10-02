/**
 * paste-special-dialog.component.ts: Ctrl/Cmd+Alt+V. Offers the four Paste
 * Special formats PowerPoint's own dialog offers (Keep Source Formatting,
 * Use Destination Theme, Picture, Keep Text Only), sourced from
 * `pptx-viewer-shared` so the option set and its labels cannot drift from the
 * post-paste "Paste Options" toolbar or the other four bindings.
 *
 * Selector: `pptx-paste-special-dialog`
 *
 * Angular port of the React `PasteSpecialDialog.tsx` / Vue `PasteSpecialDialog.vue`.
 */
import {
	ChangeDetectionStrategy,
	CUSTOM_ELEMENTS_SCHEMA,
	Component,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PASTE_SPECIAL_OPTIONS } from '../internal/shared';
import type { PasteSpecialFormat } from '../internal/shared';
import { DialogFooterComponent } from './dialog-footer.component';
import type { DialogFooterActionSpec } from './dialog-footer.component';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-paste-special-dialog',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DialogFooterComponent, ModalDialogComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.pasteSpecial.dialogTitle' | translate"
			(close)="cancel.emit()"
		>
			<ul class="pptx-ng-paste-special-list">
				@for (option of options; track option.id) {
					<li>
						<label class="pptx-ng-paste-special-option">
							<pptx-ui-radio
								name="paste-special-format"
								[checked]="selected() === option.id"
								(change)="selected.set(option.id)"
							/>
							{{ option.labelKey | translate }}
						</label>
					</li>
				}
			</ul>

			<div footer>
				<pptx-dialog-footer
					[actions]="footerActions"
					(action)="$event === 'ok' ? confirm.emit(selected()) : cancel.emit()"
				/>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-paste-special-list {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.pptx-ng-paste-special-option {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.375rem 0.5rem;
				border-radius: 0.25rem;
				font-size: 0.8125rem;
				color: var(--pptx-foreground, #f3f4f6);
				cursor: pointer;
			}

			.pptx-ng-paste-special-option:hover {
				background: var(--pptx-accent, #1f2937);
			}
		`,
	],
})
export class PasteSpecialDialogComponent {
	protected readonly footerActions: readonly DialogFooterActionSpec[] = [
		{ id: 'cancel', labelKey: 'pptx.common.cancel' },
		{ id: 'ok', labelKey: 'pptx.common.ok', variant: 'primary' },
	];

	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Fired when the dialog is cancelled (backdrop, Escape, or Cancel). */
	readonly cancel = output<void>();

	/** Fired with the chosen format when OK is pressed. */
	readonly confirm = output<PasteSpecialFormat>();

	protected readonly options = PASTE_SPECIAL_OPTIONS;
	protected readonly selected = signal<PasteSpecialFormat>('keep-source-formatting');

	constructor() {
		// Reset to the default choice every time the dialog opens.
		effect(() => {
			if (this.open()) {
				this.selected.set('keep-source-formatting');
			}
		});
	}
}
