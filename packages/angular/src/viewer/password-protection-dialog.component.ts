/**
 * password-protection-dialog.component.ts: Set, update, or remove a password
 * that protects the presentation.
 *
 * Selector: `pptx-password-protection-dialog`
 *
 * Angular port of the React `PasswordProtectionDialog` component
 * (`packages/react/src/viewer/components/PasswordProtectionDialog.tsx`). Composes
 * {@link ModalDialogComponent} and {@link PasswordStrengthMeterComponent}. Owns
 * a small amount of local form state (the two password fields, the show/hide
 * toggle, and the inline error) as signals. Strength scoring and submit
 * validation live in the pure {@link ./password-protection-helpers} module.
 * Drops react-i18next in favour of the English fallback copy.
 */

import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ModalDialogComponent } from './modal-dialog.component';
import { validatePassword } from './password-protection-helpers';
import { PasswordStrengthMeterComponent } from './password-strength-meter.component';

@Component({
	selector: 'pptx-password-protection-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, PasswordStrengthMeterComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.security.protectPresentation' | translate"
			(close)="onClose()"
		>
			<div class="pptx-ng-pw">
				@if (isCurrentlyProtected()) {
					<div class="pptx-ng-pw-banner">
						<span class="pptx-ng-pw-banner-icon">&#128274;</span>
						<span>{{ 'pptx.security.currentlyProtected' | translate }}</span>
					</div>
				}

				<p class="pptx-ng-pw-desc">
					{{ 'pptx.security.description' | translate }}
				</p>

				<div class="pptx-ng-pw-field">
					<label for="pptx-ng-pw-password" class="pptx-ng-pw-label">{{
						'pptx.security.password' | translate
					}}</label>
					<div class="pptx-ng-pw-input-wrap">
						<input
							id="pptx-ng-pw-password"
							name="presentation-password"
							autocomplete="new-password"
							[attr.aria-invalid]="error() ? 'true' : null"
							[attr.aria-describedby]="error() ? 'pptx-ng-pw-error' : null"
							class="pptx-ng-pw-input"
							[type]="showPassword() ? 'text' : 'password'"
							[attr.placeholder]="'pptx.security.passwordPlaceholder' | translate"
							[value]="password()"
							(input)="onPasswordInput($event)"
						/>
						<button
							type="button"
							class="pptx-ng-pw-toggle"
							[attr.aria-label]="
								(showPassword() ? 'pptx.security.hidePassword' : 'pptx.security.showPassword')
									| translate
							"
							(click)="showPassword.set(!showPassword())"
						>
							{{ (showPassword() ? 'pptx.security.hide' : 'pptx.security.show') | translate }}
						</button>
					</div>
				</div>

				<pptx-password-strength-meter [password]="password()" />

				<div class="pptx-ng-pw-field">
					<label for="pptx-ng-pw-confirm" class="pptx-ng-pw-label">{{
						'pptx.security.confirmPassword' | translate
					}}</label>
					<input
						id="pptx-ng-pw-confirm"
						name="presentation-password-confirmation"
						autocomplete="new-password"
						[attr.aria-invalid]="error() ? 'true' : null"
						[attr.aria-describedby]="error() ? 'pptx-ng-pw-error' : null"
						class="pptx-ng-pw-input"
						[type]="showPassword() ? 'text' : 'password'"
						[attr.placeholder]="'pptx.security.confirmPasswordPlaceholder' | translate"
						[value]="confirmPassword()"
						(input)="onConfirmInput($event)"
					/>
				</div>

				@if (error()) {
					<p id="pptx-ng-pw-error" class="pptx-ng-pw-error" role="alert">{{ error() }}</p>
				}
			</div>

			<div footer class="pptx-ng-pw-footer">
				<div class="pptx-ng-pw-footer-left">
					@if (isCurrentlyProtected()) {
						<button type="button" class="pptx-ng-pw-remove" (click)="onRemove()">
							{{ 'pptx.security.removePassword' | translate }}
						</button>
					}
				</div>
				<div class="pptx-ng-pw-footer-right">
					<button type="button" class="pptx-ng-pw-btn" (click)="onClose()">
						{{ 'pptx.common.cancel' | translate }}
					</button>
					<button type="button" class="pptx-ng-pw-btn pptx-ng-pw-btn-primary" (click)="onSubmit()">
						{{
							(isCurrentlyProtected()
								? 'pptx.security.updatePassword'
								: 'pptx.security.setPassword'
							) | translate
						}}
					</button>
				</div>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-pw {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.pptx-ng-pw-banner {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				border: 1px solid rgba(34, 197, 94, 0.4);
				border-radius: 0.5rem;
				background: rgba(34, 197, 94, 0.12);
				color: #22c55e;
				font-size: 0.75rem;
			}

			.pptx-ng-pw-desc {
				margin: 0;
				font-size: 0.75rem;
				line-height: 1.5;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-pw-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}

			.pptx-ng-pw-label {
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-pw-input-wrap {
				position: relative;
				display: flex;
				align-items: center;
			}

			.pptx-ng-pw-input {
				width: 100%;
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-background, #030712);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.8125rem;
			}

			.pptx-ng-pw-input:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
			}

			.pptx-ng-pw-toggle {
				position: absolute;
				right: 0.375rem;
				padding: 0.125rem 0.375rem;
				border: none;
				background: transparent;
				color: var(--pptx-muted-foreground, #9ca3af);
				font-size: 0.6875rem;
				cursor: pointer;
			}

			.pptx-ng-pw-toggle:hover {
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-pw-error {
				margin: 0;
				font-size: 0.75rem;
				color: #f87171;
			}

			.pptx-ng-pw-footer {
				display: flex;
				flex: 1;
				align-items: center;
				justify-content: space-between;
			}

			.pptx-ng-pw-footer-right {
				display: flex;
				gap: 0.5rem;
			}

			.pptx-ng-pw-remove {
				border: none;
				background: transparent;
				color: #f87171;
				font-size: 0.75rem;
				cursor: pointer;
			}

			.pptx-ng-pw-remove:hover {
				filter: brightness(1.15);
			}

			.pptx-ng-pw-btn {
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				cursor: pointer;
				white-space: nowrap;
			}

			.pptx-ng-pw-btn:hover {
				background: var(--pptx-border, #374151);
			}

			.pptx-ng-pw-btn-primary {
				border-color: var(--pptx-primary, #6366f1);
				background: var(--pptx-primary, #6366f1);
				color: #ffffff;
			}

			.pptx-ng-pw-btn-primary:hover {
				filter: brightness(1.1);
			}
		`,
	],
})
export class PasswordProtectionDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Whether the presentation already has a password. */
	readonly isCurrentlyProtected = input<boolean>(false);

	/** Fired with the new password when the user confirms. */
	readonly setPassword = output<string>();

	/** Fired when the user removes the existing password. */
	readonly removePassword = output<void>();

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	readonly password = signal('');
	readonly confirmPassword = signal('');
	readonly showPassword = signal(false);
	readonly error = signal('');

	constructor() {
		// Clear the local form whenever the dialog is closed by the host.
		effect(() => {
			if (!this.open()) {
				this.resetFields();
			}
		});
	}

	onPasswordInput(event: Event): void {
		this.password.set((event.target as HTMLInputElement).value);
		this.error.set('');
	}

	onConfirmInput(event: Event): void {
		this.confirmPassword.set((event.target as HTMLInputElement).value);
		this.error.set('');
	}

	onSubmit(): void {
		const message = validatePassword(this.password(), this.confirmPassword());
		this.error.set(message);
		if (message) {
			return;
		}
		this.setPassword.emit(this.password());
		this.resetFields();
		this.close.emit();
	}

	onRemove(): void {
		this.removePassword.emit();
		this.resetFields();
		this.close.emit();
	}

	onClose(): void {
		this.resetFields();
		this.close.emit();
	}

	private resetFields(): void {
		this.password.set('');
		this.confirmPassword.set('');
		this.error.set('');
	}
}
