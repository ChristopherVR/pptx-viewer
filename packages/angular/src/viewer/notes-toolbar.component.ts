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
	template: `
		<div class="pptx-ng-notes-toolbar" role="toolbar" aria-label="Notes formatting">
			<div class="pptx-ng-notes-tb-group">
				@for (btn of buttons; track btn.labelKey) {
					<button
						type="button"
						class="pptx-ng-notes-tb-btn"
						[class.has-divider]="btn.group"
						[title]="btn.labelKey | translate"
						[attr.aria-label]="btn.labelKey | translate"
						(click)="run(btn.action)"
					>
						<svg
							viewBox="0 0 24 24"
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path [attr.d]="btn.path" />
						</svg>
					</button>
				}

				@if (showLinkPopover()) {
					<div class="pptx-ng-notes-link-popover">
						<form (submit)="submitLink($event)">
							<label class="pptx-ng-notes-link-label">{{ 'pptx.notes.linkUrl' | translate }}</label>
							<input
								#linkUrlInput
								class="pptx-ng-notes-link-input"
								type="text"
								[attr.placeholder]="'pptx.notes.linkUrlPlaceholder' | translate"
								[value]="linkUrl()"
								(input)="linkUrl.set(asValue($event))"
							/>
							<label class="pptx-ng-notes-link-label">{{
								'pptx.notes.linkDisplayText' | translate
							}}</label>
							<input
								class="pptx-ng-notes-link-input"
								type="text"
								[attr.placeholder]="'pptx.notes.linkDisplayText' | translate"
								[value]="linkText()"
								(input)="linkText.set(asValue($event))"
							/>
							<div class="pptx-ng-notes-link-actions">
								<button
									type="button"
									class="pptx-ng-notes-link-cancel"
									(click)="closeLinkPopover.emit()"
								>
									{{ 'pptx.common.cancel' | translate }}
								</button>
								<button type="submit" class="pptx-ng-notes-link-insert">
									{{ 'pptx.notes.insertLink' | translate }}
								</button>
							</div>
						</form>
					</div>
				}
			</div>

			<button
				type="button"
				class="pptx-ng-notes-tb-toggle"
				[title]="
					(isRichEnabled() ? 'pptx.notes.switchToPlainEditor' : 'pptx.notes.switchToRichEditor')
						| translate
				"
				(click)="toggleRich.emit()"
			>
				{{ (isRichEnabled() ? 'pptx.notes.plainEditor' : 'pptx.notes.richEditor') | translate }}
			</button>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.pptx-ng-notes-toolbar {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				margin-bottom: 0.25rem;
			}
			.pptx-ng-notes-tb-group {
				position: relative;
				display: inline-flex;
				align-items: center;
				overflow: hidden;
				border: 1px solid rgba(0, 0, 0, 0.12);
				border-radius: 0.25rem;
				background: rgba(0, 0, 0, 0.03);
			}
			.pptx-ng-notes-tb-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 0.25rem 0.4rem;
				border: none;
				background: transparent;
				color: #111827;
				cursor: pointer;
			}
			.pptx-ng-notes-tb-btn.has-divider {
				border-left: 1px solid rgba(0, 0, 0, 0.12);
			}
			.pptx-ng-notes-tb-btn:hover {
				background: rgba(0, 0, 0, 0.06);
			}
			.pptx-ng-notes-tb-toggle {
				padding: 0.2rem 0.5rem;
				font-size: 10px;
				border: 1px solid rgba(0, 0, 0, 0.12);
				border-radius: 0.25rem;
				background: rgba(0, 0, 0, 0.03);
				color: #111827;
				cursor: pointer;
			}
			.pptx-ng-notes-tb-toggle:hover {
				background: rgba(0, 0, 0, 0.06);
			}
			.pptx-ng-notes-link-popover {
				position: absolute;
				bottom: 100%;
				left: 0;
				z-index: 10;
				width: 18rem;
				margin-bottom: 0.25rem;
				padding: 0.75rem;
				border: 1px solid rgba(0, 0, 0, 0.15);
				border-radius: 0.5rem;
				background: #ffffff;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
			}
			.pptx-ng-notes-link-label {
				display: block;
				margin: 0 0 0.125rem;
				font-size: 10px;
				color: #6b7280;
			}
			.pptx-ng-notes-link-input {
				width: 100%;
				margin-bottom: 0.5rem;
				padding: 0.25rem 0.5rem;
				font-size: 12px;
				border: 1px solid rgba(0, 0, 0, 0.15);
				border-radius: 0.25rem;
			}
			.pptx-ng-notes-link-actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
			.pptx-ng-notes-link-cancel {
				padding: 0.25rem 0.5rem;
				font-size: 10px;
				border: none;
				background: transparent;
				color: #6b7280;
				cursor: pointer;
			}
			.pptx-ng-notes-link-insert {
				padding: 0.25rem 0.5rem;
				font-size: 10px;
				border: none;
				border-radius: 0.25rem;
				background: #6366f1;
				color: #ffffff;
				cursor: pointer;
			}
		`,
	],
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
