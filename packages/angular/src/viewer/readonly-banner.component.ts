/**
 * readonly-banner.component.ts: Read-only recommendation banner.
 *
 * Selector: `pptx-readonly-banner`
 *
 * A thin adapter around the shared `pptx-ui-read-only-banner` element, which
 * owns the markup, the inline password form and its focus.
 * {@link LoadNoticesService} decides WHETHER a deck recommends read-only
 * (`p:modifyVerifier` / "Mark as Final", see shared's
 * `read-only-recommendation.ts`) and which message key to show; this component
 * maps that decision onto the element's state and re-emits its typed intents.
 *
 * When `passwordPromptOpen` is set (a `modifyVerifier` with a hash this
 * viewer can check), the two buttons are replaced by an inline password
 * form: PowerPoint's own "read-only recommended" prompt keeps the deck
 * locked until the correct password is entered, and a wrong one leaves it
 * locked.
 *
 * @module viewer/readonly-banner
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import type {
	ReadOnlyBannerRequestEvent,
	ReadOnlyBannerViewState,
	ReadOnlyRecommendationKind,
} from '../internal/shared';
import type { ModifyPasswordErrorReason } from './load-notices.service';
import { translationsSignal } from './translations-signal';

@Component({
	selector: 'pptx-readonly-banner',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { class: 'contents' },
	template: ` <pptx-ui-read-only-banner [state]="view()" (read-only-request)="request($event)" /> `,
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

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	protected readonly view = computed<ReadOnlyBannerViewState>(() => {
		this.translations();
		return {
			kind: this.kind(),
			messageKey: this.messageKey(),
			passwordPromptOpen: this.passwordPromptOpen(),
			passwordError: this.passwordError(),
			checkingPassword: this.checkingPassword(),
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	protected request(event: Event): void {
		const intent = (event as ReadOnlyBannerRequestEvent).detail;
		switch (intent.id) {
			case 'editAnyway':
				this.editAnyway.emit();
				break;
			case 'dismiss':
				this.dismiss.emit();
				break;
			case 'cancelPassword':
				this.cancelPassword.emit();
				break;
			case 'submitPassword':
				this.submitPassword.emit(intent.password);
		}
	}
}
