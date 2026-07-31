/**
 * notes-toolbar.component.ts: formatting toolbar for the rich speaker-notes
 * editor. Private child of {@link NotesPanelComponent} (not exported from the
 * package barrel).
 *
 * Mirrors React's `NotesToolbar` (bold/italic/underline/strikethrough, bullet
 * and numbered lists, indent/outdent, hyperlink popover, print, and the
 * rich/plain toggle). Purely presentational: every control emits an intent and
 * the parent panel runs it through the shared `pptx-viewer-shared` notes
 * helpers. The hyperlink popover is owned here, with its own local signals.
 *
 * Icons are inline Lucide-style stroke SVG (no icon dependency), matching the
 * other Angular toolbars.
 */

import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	effect,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { NotesInlineCommand, NotesParagraphCommand } from '../internal/shared';

/** A toolbar button's emitted intent. */
type ToolbarAction =
	| { kind: 'inline'; cmd: NotesInlineCommand }
	| { kind: 'para'; cmd: NotesParagraphCommand }
	| { kind: 'link' }
	| { kind: 'print' };

interface ToolbarButton {
	labelKey: string;
	path: string;
	action: ToolbarAction;
	/** Start a new visual group (left divider) before this button. */
	group?: boolean;
}

@Component({
	selector: 'pptx-notes-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	templateUrl: './notes-toolbar.component.html',
	styleUrl: './notes-toolbar.component.css',
})
export class NotesToolbarComponent {
	readonly isRichEnabled = input.required<boolean>();
	readonly showLinkPopover = input.required<boolean>();
	readonly savedSelectionText = input.required<string>();

	readonly inline = output<NotesInlineCommand>();
	readonly paragraph = output<NotesParagraphCommand>();
	readonly linkButtonClick = output<void>();
	readonly insertLink = output<{ url: string; displayText: string }>();
	readonly closeLinkPopover = output<void>();
	readonly print = output<void>();
	readonly toggleRich = output<void>();

	protected readonly linkUrl = signal('');
	protected readonly linkText = signal('');
	private readonly linkUrlInput = viewChild<ElementRef<HTMLInputElement>>('linkUrlInput');

	/** Lucide-style icon paths, kept inline so the toolbar has no icon dependency. */
	protected readonly buttons: readonly ToolbarButton[] = [
		{
			labelKey: 'pptx.notes.bold',
			action: { kind: 'inline', cmd: 'bold' },
			path: 'M6 4h8a4 4 0 0 1 0 8H6z M6 12h9a4 4 0 0 1 0 8H6z',
		},
		{
			labelKey: 'pptx.notes.italic',
			action: { kind: 'inline', cmd: 'italic' },
			path: 'M19 4h-9 M14 20H5 M15 4 9 20',
		},
		{
			labelKey: 'pptx.notes.underline',
			action: { kind: 'inline', cmd: 'underline' },
			path: 'M6 4v6a6 6 0 0 0 12 0V4 M4 20h16',
		},
		{
			labelKey: 'pptx.notes.strikethrough',
			action: { kind: 'inline', cmd: 'strikeThrough' },
			path: 'M16 4H9a3 3 0 0 0-2.83 4 M14 12a4 4 0 0 1 0 8H6 M4 12h16',
		},
		{
			labelKey: 'pptx.notes.bulletList',
			action: { kind: 'para', cmd: 'bullet' },
			path: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
			group: true,
		},
		{
			labelKey: 'pptx.notes.numberedList',
			action: { kind: 'para', cmd: 'numbered' },
			path: 'M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 18H4c0-1 2-1.5 2-2.5S5 14 4 14',
		},
		{
			labelKey: 'pptx.notes.indent',
			action: { kind: 'para', cmd: 'indent' },
			path: 'm3 8 4 4-4 4 M11 12h10 M11 6h10 M11 18h10',
			group: true,
		},
		{
			labelKey: 'pptx.notes.outdent',
			action: { kind: 'para', cmd: 'outdent' },
			path: 'm7 8-4 4 4 4 M11 12h10 M11 6h10 M11 18h10',
		},
		{
			labelKey: 'pptx.notes.insertLink',
			action: { kind: 'link' },
			path: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
			group: true,
		},
		{
			labelKey: 'pptx.notes.printNotes',
			action: { kind: 'print' },
			path: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
		},
	];

	constructor() {
		// Seed the display-text field from the captured selection and focus the URL
		// input each time the popover opens.
		effect(() => {
			if (this.showLinkPopover()) {
				this.linkUrl.set('');
				this.linkText.set(this.savedSelectionText());
				queueMicrotask(() => this.linkUrlInput()?.nativeElement.focus());
			}
		});
	}

	protected asValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	protected run(action: ToolbarAction): void {
		switch (action.kind) {
			case 'inline':
				this.inline.emit(action.cmd);
				return;
			case 'para':
				this.paragraph.emit(action.cmd);
				return;
			case 'link':
				this.linkButtonClick.emit();
				return;
			case 'print':
				this.print.emit();
		}
	}

	protected submitLink(event: Event): void {
		event.preventDefault();
		if (this.linkUrl().trim().length === 0) {
			return;
		}
		this.insertLink.emit({ url: this.linkUrl(), displayText: this.linkText() });
	}
}
