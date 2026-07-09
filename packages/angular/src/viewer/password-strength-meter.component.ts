/**
 * password-strength-meter.component.ts: the five-bar strength indicator for the
 * password-protection dialog.
 *
 * Selector: `pptx-password-strength-meter`
 *
 * Split out of {@link PasswordProtectionDialogComponent} to keep each file
 * focused. Given a `password`, derives its strength via
 * {@link getPasswordStrength} and paints the bars / label accordingly. Renders
 * nothing when the password is empty.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import {
	getPasswordStrength,
	getStrengthLabel,
	STRENGTH_COLORS,
} from './password-protection-helpers';

@Component({
	selector: 'pptx-password-strength-meter',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (password()) {
			<div class="pptx-ng-pw-strength">
				<div class="pptx-ng-pw-bars">
					@for (i of bars; track i) {
						<div
							class="pptx-ng-pw-bar"
							[style.background]="i <= strength() ? strengthColor() : 'var(--pptx-muted, #374151)'"
						></div>
					}
				</div>
				<p class="pptx-ng-pw-strength-label">{{ strengthLabel() }}</p>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-pw-strength {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}

			.pptx-ng-pw-bars {
				display: flex;
				gap: 0.25rem;
			}

			.pptx-ng-pw-bar {
				height: 0.25rem;
				flex: 1;
				border-radius: 9999px;
				transition: background 0.15s ease;
			}

			.pptx-ng-pw-strength-label {
				margin: 0;
				font-size: 0.6875rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
		`,
	],
})
export class PasswordStrengthMeterComponent {
	/** Current password (source of the derived strength). */
	readonly password = input<string>('');

	readonly bars = [0, 1, 2, 3, 4];

	private readonly translate = inject(TranslateService);

	readonly strength = computed(() => getPasswordStrength(this.password()));
	readonly strengthColor = computed(() => STRENGTH_COLORS[this.strength()]);
	readonly strengthLabel = computed(() =>
		this.password() ? getStrengthLabel(this.strength(), this.translate) : '',
	);
}
