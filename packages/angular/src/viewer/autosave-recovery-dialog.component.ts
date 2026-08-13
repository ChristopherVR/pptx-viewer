/**
 * autosave-recovery-dialog.component.ts: "we found unsaved changes for this
 * deck, want them?"
 *
 * Selector: `pptx-autosave-recovery-dialog`
 *
 * Pure presentation over the shared `AutosaveRecoveryPrompt` descriptor
 * (`pptx-viewer-shared/render/autosave-recovery`), so all five bindings offer
 * the same recovery with the same words. Every string is a key chosen by the
 * shared module; this component picks none of them. Composes
 * {@link ModalDialogComponent}; dismissing counts as "discard", matching the
 * React and Vue dialogs.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import type { AutosaveRecoveryPrompt } from '../internal/shared';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-autosave-recovery-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, TranslatePipe],
	template: `
		@if (prompt(); as offer) {
			<pptx-modal-dialog
				[open]="true"
				[title]="offer.titleKey | translate"
				data-pptx-autosave-recovery="true"
				(close)="discard.emit()"
			>
				<div class="pptx-ng-recovery">
					<div class="pptx-ng-recovery-badge">&#8635;</div>
					<div>
						<p class="pptx-ng-recovery-desc">
							{{ offer.messageKey | translate: offer.messageParams }}
						</p>
						<p class="pptx-ng-recovery-when">{{ savedLabel() }}</p>
					</div>
				</div>

				<div footer>
					<button type="button" class="pptx-ng-recovery-btn" (click)="discard.emit()">
						{{ offer.discardKey | translate }}
					</button>
					<button
						type="button"
						class="pptx-ng-recovery-btn pptx-ng-recovery-btn-primary"
						(click)="restore.emit()"
					>
						{{ offer.restoreKey | translate }}
					</button>
				</div>
			</pptx-modal-dialog>
		}
	`,
	styles: [
		`
			.pptx-ng-recovery {
				display: flex;
				align-items: flex-start;
				gap: 0.75rem;
			}

			.pptx-ng-recovery-badge {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 2.5rem;
				height: 2.5rem;
				flex-shrink: 0;
				border-radius: 9999px;
				background: rgba(99, 102, 241, 0.15);
				font-size: 1.125rem;
			}

			.pptx-ng-recovery-desc {
				margin: 0;
				font-size: 0.8125rem;
				line-height: 1.5;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-recovery-when {
				margin: 0.5rem 0 0;
				font-size: 0.6875rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-recovery-btn {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				padding: 0.375rem 0.875rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				font-weight: 500;
				cursor: pointer;
				white-space: nowrap;
			}

			.pptx-ng-recovery-btn:hover {
				background: var(--pptx-border, #374151);
			}

			.pptx-ng-recovery-btn-primary {
				border-color: var(--pptx-primary, #6366f1);
				background: var(--pptx-primary, #6366f1);
				color: #ffffff;
			}

			.pptx-ng-recovery-btn-primary:hover {
				filter: brightness(1.1);
			}
		`,
	],
})
export class AutosaveRecoveryDialogComponent {
	private readonly translate = inject(TranslateService);

	/** The shared descriptor to render, or null to render nothing. */
	readonly prompt = input<AutosaveRecoveryPrompt | null>(null);

	/** The user accepted: load the snapshot. */
	readonly restore = output<void>();

	/** The user declined (also on dismiss): drop the snapshot. */
	readonly discard = output<void>();

	/** "Autosaved 5 min ago", built from the two keys the descriptor names. */
	protected readonly savedLabel = computed(() => {
		const offer = this.prompt();
		if (!offer) {
			return '';
		}
		const when = this.translate.instant(offer.ageKey, offer.ageParams);
		return this.translate.instant('pptx.autosave.recovery.savedLabel', { when });
	});
}
