/**
 * dialog-footer.component.ts: the action row at the bottom of a dialog.
 *
 * Selector: `pptx-dialog-footer`
 *
 * A thin adapter around the shared `pptx-ui-dialog-footer`. Hosts pass actions
 * with translation keys (translated here, so a language change re-labels the
 * row) and receive the activated id. The dialog shell ({@link ModalDialogComponent}),
 * its backdrop and dismissal stay in the dialog.
 *
 * @module viewer/dialog-footer
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
	DialogFooterAction,
	DialogFooterRequestEvent,
	DialogFooterViewState,
} from '../internal/shared';
import { translationsSignal } from './translations-signal';

/** A footer action whose label is a translation key. */
export type DialogFooterActionSpec = Omit<DialogFooterAction, 'label'> & { labelKey: string };

@Component({
	selector: 'pptx-dialog-footer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { class: 'contents' },
	template: `<pptx-ui-dialog-footer [state]="view()" (dialog-footer-request)="request($event)" />`,
})
export class DialogFooterComponent {
	readonly actions = input.required<readonly DialogFooterActionSpec[]>();
	/** The activated action's id. */
	readonly action = output<string>();

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	protected readonly view = computed<DialogFooterViewState>(() => {
		this.translations();
		return {
			actions: this.actions().map(({ labelKey, ...rest }) => ({
				...rest,
				label: this.translate.instant(labelKey),
			})),
		};
	});

	protected request(event: Event): void {
		this.action.emit((event as DialogFooterRequestEvent).detail.id);
	}
}
