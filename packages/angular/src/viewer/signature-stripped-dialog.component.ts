/**
 * signature-stripped-dialog.component.ts: Warning shown when the user first
 * edits a digitally signed presentation.
 *
 * Selector: `pptx-signature-stripped-dialog`
 *
 * Angular port of the React `SignatureStrippedDialog` component
 * (`packages/react/src/viewer/components/SignatureStrippedDialog.tsx`). Composes
 * {@link ModalDialogComponent}. Explains that editing invalidates and removes the
 * document's digital signatures, and that the change cannot be undone. Dismissing
 * the modal counts as a cancel. Drops react-i18next in favour of the English
 * fallback copy.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogFooterComponent } from './dialog-footer.component';
import type { DialogFooterActionSpec } from './dialog-footer.component';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-signature-stripped-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DialogFooterComponent, ModalDialogComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.digitalSignatures.strippedTitle' | translate"
			(close)="cancel.emit()"
		>
			<div class="pptx-ng-sig">
				<div class="pptx-ng-sig-callout">
					<span class="pptx-ng-sig-icon">&#9888;</span>
					<div class="pptx-ng-sig-text">
						<p class="pptx-ng-sig-message">
							{{
								'pptx.digitalSignatures.strippedMessage' | translate: { count: signatureCount() }
							}}
						</p>
						<p class="pptx-ng-sig-warning">
							{{ 'pptx.digitalSignatures.editWarning' | translate }}
						</p>
					</div>
				</div>
			</div>

			<div footer>
				<pptx-dialog-footer
					[actions]="footerActions"
					(action)="$event === 'confirm' ? confirm.emit() : cancel.emit()"
				/>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-sig {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.pptx-ng-sig-callout {
				display: flex;
				align-items: flex-start;
				gap: 0.75rem;
				padding: 0.75rem 1rem;
				border: 1px solid rgba(217, 119, 6, 0.3);
				border-radius: 0.5rem;
				background: rgba(217, 119, 6, 0.12);
			}

			.pptx-ng-sig-icon {
				flex-shrink: 0;
				font-size: 1.125rem;
				line-height: 1.4;
			}

			.pptx-ng-sig-text {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.pptx-ng-sig-message {
				margin: 0;
				font-size: 0.75rem;
				line-height: 1.5;
				color: #fde68a;
			}

			.pptx-ng-sig-warning {
				margin: 0;
				font-size: 0.6875rem;
				line-height: 1.5;
				color: rgba(252, 211, 77, 0.7);
			}
		`,
	],
})
export class SignatureStrippedDialogComponent {
	protected readonly footerActions: readonly DialogFooterActionSpec[] = [
		{ id: 'cancel', labelKey: 'pptx.common.cancel' },
		{ id: 'confirm', labelKey: 'pptx.digitalSignatures.strippedConfirm', variant: 'warning' },
	];

	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** How many digital signatures the document carries. */
	readonly signatureCount = input<number>(0);

	/** Fired when the user accepts that signatures will be removed. */
	readonly confirm = output<void>();

	/** Fired when the user backs out (also on dismiss). */
	readonly cancel = output<void>();
}
