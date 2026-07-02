/**
 * encrypted-file-dialog.component.ts: Informational modal shown when the viewer
 * detects an encrypted PPTX that it cannot open.
 *
 * Selector: `pptx-encrypted-file-dialog`
 *
 * Angular port of the React `EncryptedFileDialog` component
 * (`packages/react/src/viewer/components/EncryptedFileDialog.tsx`). Composes
 * {@link ModalDialogComponent}. Purely informational (no password entry); a
 * single Close action dismisses it. Drops react-i18next in favour of the English
 * fallback copy.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-encrypted-file-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent],
	template: `
		<pptx-modal-dialog [open]="open()" title="Encrypted File" (close)="close.emit()">
			<div class="pptx-ng-enc">
				<div class="pptx-ng-enc-callout">
					<span class="pptx-ng-enc-icon">&#128274;</span>
					<div class="pptx-ng-enc-text">
						<p class="pptx-ng-enc-message">This presentation is encrypted and cannot be opened.</p>
						<p class="pptx-ng-enc-instructions">
							Please open the file in PowerPoint, remove the password protection, and save an
							unencrypted copy before loading it here.
						</p>
					</div>
				</div>
			</div>

			<div footer>
				<button type="button" class="pptx-ng-enc-btn" (click)="close.emit()">Close</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-enc {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.pptx-ng-enc-callout {
				display: flex;
				align-items: flex-start;
				gap: 0.75rem;
				padding: 0.75rem 1rem;
				border: 1px solid rgba(239, 68, 68, 0.3);
				border-radius: 0.5rem;
				background: rgba(239, 68, 68, 0.12);
			}

			.pptx-ng-enc-icon {
				flex-shrink: 0;
				font-size: 1.125rem;
				line-height: 1.4;
			}

			.pptx-ng-enc-text {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.pptx-ng-enc-message {
				margin: 0;
				font-size: 0.75rem;
				line-height: 1.5;
				color: #fecaca;
			}

			.pptx-ng-enc-instructions {
				margin: 0;
				font-size: 0.6875rem;
				line-height: 1.5;
				color: rgba(252, 165, 165, 0.7);
			}

			.pptx-ng-enc-btn {
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				cursor: pointer;
			}

			.pptx-ng-enc-btn:hover {
				background: var(--pptx-border, #374151);
			}
		`,
	],
})
export class EncryptedFileDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();
}
