/**
 * notes-toolbar.component.ts: formatting toolbar for the rich speaker-notes
 * editor. Private child of {@link NotesPanelComponent} (not exported from the
 * package barrel).
 *
 * A thin adapter around the shared `pptx-ui-notes-toolbar` element: the
 * buttons, order, icons, roving focus and the hyperlink popover live in the
 * shared view. This component maps panel state onto the element and re-emits
 * its typed intents; the parent panel runs them through the shared notes
 * helpers.
 */

import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map, merge, startWith } from 'rxjs';

import type {
	NotesInlineCommand,
	NotesParagraphCommand,
	NotesToolbarRequestEvent,
	NotesToolbarViewState,
} from '../internal/shared';

@Component({
	selector: 'pptx-notes-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { class: 'pptx-ng-notes-toolbar-host' },
	template: `<pptx-ui-notes-toolbar [state]="view()" (notes-request)="request($event)" />`,
	styles: [':host { display: block; }'],
})
export class NotesToolbarComponent {
	readonly isRichEnabled = input.required<boolean>();

	readonly inline = output<NotesInlineCommand>();
	readonly paragraph = output<NotesParagraphCommand>();
	readonly insertLink = output<{ url: string; displayText: string }>();
	readonly print = output<void>();
	readonly toggleRich = output<void>();

	private readonly translate = inject(TranslateService);
	/** Changes on language/dictionary updates so OnPush re-translates the view. */
	private readonly translations = toSignal(
		merge(this.translate.onLangChange, this.translate.onTranslationChange).pipe(
			map(() => Date.now()),
			startWith(0),
		),
		{ initialValue: 0 },
	);

	protected view(): NotesToolbarViewState {
		this.translations();
		const rich = this.isRichEnabled();
		return {
			rich,
			canFormat: rich,
			showPrint: true,
			translate: (key, params) => this.translate.instant(key, params),
		};
	}

	protected request(event: Event): void {
		const intent = (event as NotesToolbarRequestEvent).detail;
		switch (intent.kind) {
			case 'inline':
				this.inline.emit(intent.command);
				return;
			case 'paragraph':
				this.paragraph.emit(intent.command);
				return;
			case 'link':
				this.insertLink.emit({ url: intent.url, displayText: intent.text });
				return;
			case 'print':
				this.print.emit();
				return;
			case 'toggle-rich':
				this.toggleRich.emit();
		}
	}
}
