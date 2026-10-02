/**
 * compat-toasts.component.ts: Load-diagnostic toast stack.
 *
 * Selector: `pptx-compat-toasts`
 *
 * A thin adapter around the shared `pptx-ui-compat-toasts` element, which
 * renders the stack and positions itself from shared's `COMPAT_TOAST_METRICS`
 * (anchored to the VIEWER ROOT, `.pptx-ng-viewer`, which is `position: relative`
 * and the same containing block the dialogs use; bottom-inset above the status
 * bar so a toast can never cover the "Slide show" button).
 *
 * Toasts are load diagnostics, not transient notices: they never auto-hide.
 *
 * @module viewer/compat-toasts
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
	CompatibilityWarningToast,
	CompatToastsRequestEvent,
	CompatToastsViewState,
} from '../internal/shared';
import { translationsSignal } from './translations-signal';

@Component({
	selector: 'pptx-compat-toasts',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { class: 'contents' },
	template: `
		@if (toasts().length > 0) {
			<pptx-ui-compat-toasts [state]="view()" (compat-toasts-request)="request($event)" />
		}
	`,
})
export class CompatToastsComponent {
	/** The dismiss-filtered toast list ({@link LoadNoticesService.visibleToasts}). */
	readonly toasts = input.required<readonly CompatibilityWarningToast[]>();
	/**
	 * Width of the currently-open right-docked panel (format/inspector or AI
	 * chat), 0 when none is open. The viewer ROOT this stack is anchored to
	 * spans the FULL chrome width including that panel, so without this the
	 * stack's `right: 12px` lands under the panel's own content (it visually
	 * overlapped the Properties panel's "Presentation" section) instead of
	 * clear of it.
	 */
	readonly rightInset = input<number>(0);
	/**
	 * Live height of the docked "Speaker notes" strip (0 when it is not
	 * rendered). It sits between the canvas and the status bar in the same
	 * containing block, so without this the stack overlaps it.
	 */
	readonly bottomInset = input<number>(0);
	/** Dismiss one toast by id. */
	readonly dismissOne = output<string>();
	/** Dismiss every visible toast. */
	readonly dismissAll = output<void>();

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	protected readonly view = computed<CompatToastsViewState>(() => {
		this.translations();
		return {
			toasts: this.toasts(),
			rightInset: this.rightInset(),
			bottomInset: this.bottomInset(),
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	protected request(event: Event): void {
		const intent = (event as CompatToastsRequestEvent).detail;
		if (intent.id === 'dismissAll') {
			this.dismissAll.emit();
		} else {
			this.dismissOne.emit(intent.toastId);
		}
	}
}
