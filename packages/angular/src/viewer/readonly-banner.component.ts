/**
 * readonly-banner.component.ts: Read-only recommendation banner.
 *
 * Selector: `pptx-readonly-banner`
 *
 * Purely presentational: {@link LoadNoticesService} decides WHETHER a deck
 * recommends read-only (`p:modifyVerifier` / "Mark as Final", see shared's
 * `read-only-recommendation.ts`) and which message key to show; this
 * component only renders that decision and forwards the two button clicks.
 *
 * When `passwordPromptOpen` is set (a `modifyVerifier` with a hash this
 * viewer can check), the two buttons are replaced by an inline password
 * form: PowerPoint's own "read-only recommended" prompt keeps the deck
 * locked until the correct password is entered, and a wrong one leaves it
 * locked.
 *
 * @module viewer/readonly-banner
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ReadOnlyRecommendationKind } from '../internal/shared';
import type { ModifyPasswordErrorReason } from './load-notices.service';

@Component({
	selector: 'pptx-readonly-banner',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			class="pptx-ng-readonly-banner flex items-center gap-3 border-b border-amber-700/30 bg-amber-900/20 px-4 py-2"
			data-testid="pptx-readonly-banner"
			[attr.data-kind]="kind()"
			role="status"
		>
			<span class="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true">&#128274;</span>
			<p class="flex-1 text-xs text-amber-200">
				<strong>{{ 'pptx.readOnly.bannerTitle' | translate }}</strong
				>: {{ messageKey() | translate }}
			</p>
			@if (passwordPromptOpen()) {
				<form
					data-testid="pptx-readonly-password-form"
					class="flex shrink-0 items-center gap-2"
					(submit)="onSubmit($event)"
				>
					<label [for]="inputId" class="sr-only">{{
						'pptx.readOnly.passwordLabel' | translate
					}}</label>
					<input
						[id]="inputId"
						data-testid="pptx-readonly-password-input"
						type="password"
						[disabled]="checkingPassword()"
						[value]="password()"
						(input)="password.set($any($event.target).value)"
						name="modifyPassword"
						[placeholder]="'pptx.readOnly.passwordPlaceholder' | translate"
						[attr.aria-invalid]="passwordError() !== null"
						[attr.aria-describedby]="passwordError() !== null ? errorId : null"
						class="rounded border border-amber-600/40 bg-black/20 px-2 py-1 text-xs text-amber-100"
					/>
					<button
						type="submit"
						data-testid="pptx-readonly-unlock"
						[disabled]="checkingPassword()"
						class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30 disabled:opacity-60"
					>
						{{ 'pptx.readOnly.unlock' | translate }}
					</button>
					<button
						type="button"
						data-testid="pptx-readonly-password-cancel"
						class="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-200/80 transition-colors hover:bg-amber-700/20"
						(click)="cancelPassword.emit()"
					>
						{{ 'pptx.common.cancel' | translate }}
					</button>
					@if (passwordError() !== null) {
						<span
							[id]="errorId"
							role="alert"
							data-testid="pptx-readonly-password-error"
							class="shrink-0 text-xs text-red-300"
						>
							{{
								(passwordError() === 'wrong-password'
									? 'pptx.readOnly.wrongPassword'
									: 'pptx.readOnly.unsupportedAlgorithm'
								) | translate
							}}
						</span>
					}
				</form>
			} @else {
				<button
					type="button"
					data-testid="pptx-readonly-edit-anyway"
					class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30"
					(click)="editAnyway.emit()"
				>
					{{ 'pptx.readOnly.editAnyway' | translate }}
				</button>
				<button
					type="button"
					data-testid="pptx-readonly-dismiss"
					class="shrink-0 rounded border border-transparent px-2 py-1 text-xs text-amber-200/80 transition-colors hover:text-amber-100"
					(click)="dismiss.emit()"
				>
					{{ 'pptx.readOnly.dismiss' | translate }}
				</button>
			}
		</div>
	`,
})
export class ReadOnlyBannerComponent {
	/** `ReadOnlyRecommendation.kind`; mirrored onto `data-kind` for the e2e spec. */
	readonly kind = input.required<ReadOnlyRecommendationKind>();
	/** `ReadOnlyRecommendation.messageKey`. */
	readonly messageKey = input.required<string>();
	/** Whether the inline password prompt should render instead of the two buttons. */
	readonly passwordPromptOpen = input(false);
	/** Reason the last password attempt failed, or null before any attempt / after success. */
	readonly passwordError = input<ModifyPasswordErrorReason | null>(null);
	/** True while a submitted password is being checked; disables the form. */
	readonly checkingPassword = input(false);
	/** "Edit anyway": lift the lock and hide the banner, or open the password prompt. */
	readonly editAnyway = output<void>();
	/** "Dismiss": hide the banner, keep the lock. */
	readonly dismiss = output<void>();
	/** The password form's submit. */
	readonly submitPassword = output<string>();
	/** The password form's "Cancel". */
	readonly cancelPassword = output<void>();

	protected readonly password = signal('');
	protected readonly inputId = 'pptx-readonly-password-input';
	protected readonly errorId = 'pptx-readonly-password-error-text';

	protected onSubmit(event: Event): void {
		event.preventDefault();
		this.submitPassword.emit(this.password());
	}
}
