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

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-signature-stripped-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			title="&#9888; Signatures Will Be Removed"
			(close)="cancel.emit()"
		>
			<div class="pptx-ng-sig">
				<div class="pptx-ng-sig-callout">
					<span class="pptx-ng-sig-icon">&#9888;</span>
					<div class="pptx-ng-sig-text">
						<p class="pptx-ng-sig-message">{{ message() }}</p>
						<p class="pptx-ng-sig-warning">
							This change cannot be undone. The signatures will not be restored when you save.
						</p>
					</div>
				</div>
			</div>

			<div footer>
				<button type="button" class="pptx-ng-sig-btn" (click)="cancel.emit()">Cancel</button>
				<button
					type="button"
					class="pptx-ng-sig-btn pptx-ng-sig-btn-danger"
					(click)="confirm.emit()"
				>
					Remove and Continue
				</button>
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

			.pptx-ng-sig-btn {
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				cursor: pointer;
				white-space: nowrap;
			}

			.pptx-ng-sig-btn:hover {
				background: var(--pptx-border, #374151);
			}

			.pptx-ng-sig-btn-danger {
				border-color: #d97706;
				background: #d97706;
				color: #ffffff;
			}

			.pptx-ng-sig-btn-danger:hover {
				filter: brightness(1.1);
			}
		`,
	],
})
export class SignatureStrippedDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** How many digital signatures the document carries. */
	readonly signatureCount = input<number>(0);

	/** Fired when the user accepts that signatures will be removed. */
	readonly confirm = output<void>();

	/** Fired when the user backs out (also on dismiss). */
	readonly cancel = output<void>();

	readonly message = computed(() => {
		const count = this.signatureCount();
		const noun = count === 1 ? 'digital signature' : 'digital signatures';
		return `Editing this presentation will invalidate and remove ${count} ${noun}.`;
	});
}
