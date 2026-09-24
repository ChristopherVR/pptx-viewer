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
import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PASTE_SPECIAL_OPTIONS } from '../internal/shared';
import type { PasteSpecialFormat } from '../internal/shared';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-paste-special-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, TranslatePipe],
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
							<input
								type="radio"
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
				<button type="button" class="pptx-ng-paste-special-btn" (click)="cancel.emit()">
					{{ 'pptx.common.cancel' | translate }}
				</button>
				<button
					type="button"
					class="pptx-ng-paste-special-btn pptx-ng-paste-special-btn-primary"
					(click)="confirm.emit(selected())"
				>
					{{ 'pptx.common.ok' | translate }}
				</button>
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

			.pptx-ng-paste-special-btn {
				padding: 0.5rem 1rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-background, #030712);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.8125rem;
				font-weight: 500;
				cursor: pointer;
			}

			.pptx-ng-paste-special-btn:hover {
				background: var(--pptx-accent, #1f2937);
			}

			.pptx-ng-paste-special-btn-primary {
				border-color: var(--pptx-primary, #6366f1);
				background: var(--pptx-primary, #6366f1);
				color: #ffffff;
			}

			.pptx-ng-paste-special-btn-primary:hover {
				filter: brightness(1.1);
			}
		`,
	],
})
export class PasteSpecialDialogComponent {
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
