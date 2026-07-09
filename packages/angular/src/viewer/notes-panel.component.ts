/**
 * notes-panel.component.ts: collapsible, editable speaker-notes panel.
 *
 * Ported from: packages/react/src/viewer/components/notes (rich editor) and the
 * earlier Vue/Angular plain-textarea panel.
 *
 * Renders the active slide's speaker notes. The default surface is a
 * contentEditable RICH editor (bold/italic/underline/strikethrough, bullet and
 * numbered lists, indent, hyperlinks, print), mirroring the React viewer. On a
 * mobile viewport it defaults to a plain `<textarea>` so the on-screen keyboard
 * and caret behave (the documented mobile rationale); the toolbar's rich/plain
 * toggle flips between the two on any device. All framework-agnostic logic lives
 * in `pptx-viewer-shared`; this component is the view layer + signal wiring.
 *
 * Framework-neutral e2e contract
 * ------------------------------
 * The body wrapper carries `id="slide-notes-content"` and the plain editor is a
 * `textarea[name="slide-notes"]` (kept in the DOM via `[hidden]`, not `@if`),
 * matching the React/Vue viewers so the shared Playwright specs run unchanged.
 *
 * Touch / focus correctness
 * -------------------------
 * Both surfaces are UNCONTROLLED: content is seeded imperatively (once per
 * slide, keyed by slide id) and never re-bound while the user types. Rich edits
 * are debounced; plain edits commit on `change` / `blur`. This keeps the host's
 * per-keystroke history-aware update from remounting the field mid-typing.
 */

import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { LucideChevronDown, LucideChevronRight } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxSlide, TextSegment } from 'pptx-viewer-core';

import type { NotesInlineCommand, NotesParagraphCommand } from '../internal/shared';
import {
	DEBOUNCE_MS,
	applyInlineCommand,
	applyParagraphCommand,
	buildNotesPrintHtml,
	createPlainNotesSegments,
	defaultRichEnabled,
	handleEditorAnchorClick,
	insertHyperlinkAtSelection,
	normalizeNotesLinkUrl,
	readEditorSegments,
	resolveNotesSegments,
	segmentsToEditorHtml,
	segmentsToPlainText,
} from '../internal/shared';
import { NotesToolbarComponent } from './notes-toolbar.component';

@Component({
	selector: 'pptx-notes-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NotesToolbarComponent, TranslatePipe, LucideChevronRight, LucideChevronDown],
	template: `
		<section class="pptx-ng-notes-panel" [attr.data-collapsed]="collapsed()">
			<button
				type="button"
				class="pptx-ng-notes-header"
				[attr.aria-expanded]="!collapsed()"
				(click)="toggle()"
			>
				<span class="pptx-ng-notes-label">{{ 'pptx.notes.speakerNotes' | translate }}</span>
				<span class="pptx-ng-notes-chevron" aria-hidden="true">
					@if (collapsed()) {
						<svg lucideChevronRight class="h-4 w-4"></svg>
					} @else {
						<svg lucideChevronDown class="h-4 w-4"></svg>
					}
				</span>
			</button>

			@if (!collapsed()) {
				<div id="slide-notes-content" class="pptx-ng-notes-body">
					@if (slide()) {
						<pptx-notes-toolbar
							[isRichEnabled]="isRichEnabled()"
							[showLinkPopover]="showLinkPopover()"
							[savedSelectionText]="savedSelectionText()"
							(inline)="inlineCommand($event)"
							(paragraph)="paragraphCommand($event)"
							(linkButtonClick)="openLinkPopover()"
							(insertLink)="insertLink($event)"
							(closeLinkPopover)="showLinkPopover.set(false)"
							(print)="printNotes()"
							(toggleRich)="toggleRich()"
						/>
					}

					<div
						#richEditor
						class="pptx-ng-notes-rich"
						[hidden]="!showRich()"
						[attr.contenteditable]="showRich() ? 'true' : 'false'"
						role="textbox"
						aria-multiline="true"
						[attr.aria-label]="'pptx.notes.speakerNotes' | translate"
						(input)="onRichInput()"
						(keydown)="onRichKeydown($event)"
						(blur)="onRichInput()"
						(click)="onEditorClick($event)"
					></div>

					<textarea
						#textarea
						name="slide-notes"
						class="pptx-ng-notes-textarea"
						[hidden]="showRich()"
						[disabled]="!slide()"
						[attr.placeholder]="
							(slide() ? 'pptx.notes.addSpeakerNotes' : 'pptx.notes.noSlide') | translate
						"
						[attr.aria-label]="'pptx.notes.speakerNotes' | translate"
						spellcheck="true"
						(change)="onPlainCommit($event)"
						(blur)="onPlainCommit($event)"
					></textarea>
				</div>
			}
		</section>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.pptx-ng-notes-panel {
				display: flex;
				flex-direction: column;
				border-top: 1px solid var(--pptx-border, rgba(0, 0, 0, 0.1));
				background: var(--pptx-background, #ffffff);
				color: var(--pptx-foreground, #111827);
			}
			.pptx-ng-notes-header {
				display: flex;
				width: 100%;
				align-items: center;
				justify-content: space-between;
				padding: 0.5rem 0.75rem;
				border: none;
				background: transparent;
				font-size: 0.8125rem;
				font-weight: 600;
				color: var(--pptx-muted-foreground, #6b7280);
				cursor: pointer;
			}
			.pptx-ng-notes-header:hover {
				color: var(--pptx-foreground, #111827);
			}
			.pptx-ng-notes-body {
				padding: 0 0.75rem 0.75rem;
			}
			.pptx-ng-notes-rich,
			.pptx-ng-notes-textarea {
				box-sizing: border-box;
				width: 100%;
				min-height: 5rem;
				padding: 0.5rem;
				border: 1px solid rgba(0, 0, 0, 0.15);
				border-radius: 0.375rem;
				background: rgba(0, 0, 0, 0.03);
				font: inherit;
				font-size: 0.8125rem;
				line-height: 1.5;
				color: #111827;
			}
			.pptx-ng-notes-rich {
				overflow: auto;
				resize: vertical;
			}
			.pptx-ng-notes-textarea {
				resize: vertical;
			}
			.pptx-ng-notes-rich:focus,
			.pptx-ng-notes-textarea:focus {
				outline: none;
				border-color: #6366f1;
				box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
			}
			.pptx-ng-notes-textarea:disabled {
				cursor: not-allowed;
				opacity: 0.6;
			}
		`,
	],
})
export class NotesPanelComponent {
	private readonly translate = inject(TranslateService);

	/** The active slide whose notes are shown / edited. */
	readonly slide = input<PptxSlide | undefined>(undefined);

	/**
	 * Whether the notes body is expanded. When false the panel collapses to just
	 * its header strip (React parity: the notes footer is always present below
	 * the canvas, the body toggles). Host-controlled so the status-bar Notes
	 * button and the header chevron stay in sync.
	 */
	readonly expanded = input<boolean>(false);

	/** Emits the new plain-text notes on commit. */
	readonly update = output<string>();

	/** Emits when the header strip is clicked to expand / collapse the body. */
	readonly notesToggle = output<void>();

	readonly collapsed = computed<boolean>(() => !this.expanded());
	protected readonly isRichEnabled = signal<boolean>(defaultRichEnabled());
	protected readonly showLinkPopover = signal(false);
	protected readonly savedSelectionText = signal('');

	private readonly richEditor = viewChild<ElementRef<HTMLDivElement>>('richEditor');
	private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

	/** Show the rich surface only when a slide is selected. */
	protected showRich(): boolean {
		return this.isRichEnabled() && this.slide() !== undefined;
	}

	private draftSegments: TextSegment[] = resolveNotesSegments(undefined);
	private draftText = '';
	private seededId: string | null = null;
	private debounceId: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		// Re-seed the uncontrolled surface exactly once per slide (keyed by id), so
		// an in-progress edit is never overwritten on an unrelated change pass.
		effect(() => {
			const slide = this.slide();
			const id = slide?.id ?? null;
			if (id === this.seededId) {
				return;
			}
			this.seededId = id;
			this.draftSegments = resolveNotesSegments(slide);
			this.draftText = segmentsToPlainText(this.draftSegments);
			queueMicrotask(() => this.seedActiveSurface());
		});

		afterNextRender(() => this.seedActiveSurface());
	}

	private seedActiveSurface(): void {
		if (this.isRichEnabled()) {
			const el = this.richEditor()?.nativeElement;
			if (el) {
				// Built by the shared sanitising serialiser (text escaped, links/CSS
				// allow-listed), so assigning innerHTML here is safe.
				el.innerHTML = segmentsToEditorHtml(this.draftSegments);
			}
		} else {
			const el = this.textarea()?.nativeElement;
			if (el) {
				el.value = this.draftText;
			}
		}
	}

	private emitNow(text: string): void {
		if (this.debounceId) {
			clearTimeout(this.debounceId);
			this.debounceId = null;
		}
		this.update.emit(text);
	}

	private scheduleSave(text: string): void {
		if (this.debounceId) {
			clearTimeout(this.debounceId);
		}
		this.debounceId = setTimeout(() => {
			this.update.emit(text);
			this.debounceId = null;
		}, DEBOUNCE_MS);
	}

	toggle(): void {
		this.notesToggle.emit();
	}

	/* --- Rich editor --- */

	onRichInput(): void {
		const el = this.richEditor()?.nativeElement;
		if (!el) {
			return;
		}
		const next = readEditorSegments(el);
		this.draftSegments = next.segments;
		this.draftText = next.text;
		this.scheduleSave(next.text);
	}

	inlineCommand(command: NotesInlineCommand): void {
		applyInlineCommand(command);
		this.onRichInput();
		this.richEditor()?.nativeElement.focus();
	}

	paragraphCommand(command: NotesParagraphCommand): void {
		const el = this.richEditor()?.nativeElement;
		if (!el) {
			return;
		}
		const next = applyParagraphCommand(el, this.draftSegments, command);
		this.draftSegments = next.segments;
		this.draftText = next.text;
		// List/indent changes block structure, so re-seed the DOM.
		el.innerHTML = segmentsToEditorHtml(next.segments);
		this.scheduleSave(next.text);
		el.focus();
	}

	onRichKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			this.emitNow(this.draftText);
			this.richEditor()?.nativeElement.blur();
			return;
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			this.paragraphCommand(event.shiftKey ? 'outdent' : 'indent');
		}
	}

	onEditorClick(event: MouseEvent): void {
		if (handleEditorAnchorClick(event.target, event.ctrlKey || event.metaKey)) {
			event.preventDefault();
		}
	}

	/* --- Hyperlink popover --- */

	openLinkPopover(): void {
		this.savedSelectionText.set(window.getSelection()?.toString() ?? '');
		this.showLinkPopover.set(true);
	}

	insertLink(link: { url: string; displayText: string }): void {
		this.showLinkPopover.set(false);
		const el = this.richEditor()?.nativeElement;
		if (!el) {
			return;
		}
		el.focus();
		const finalUrl = normalizeNotesLinkUrl(link.url);
		insertHyperlinkAtSelection(finalUrl, link.displayText || finalUrl);
		this.onRichInput();
	}

	/* --- Plain textarea --- */

	onPlainCommit(event: Event): void {
		const value = (event.target as HTMLTextAreaElement).value;
		this.draftText = value;
		this.draftSegments = createPlainNotesSegments(value);
		this.emitNow(value);
	}

	/* --- Toggle + print --- */

	toggleRich(): void {
		const richEl = this.richEditor()?.nativeElement;
		const plainEl = this.textarea()?.nativeElement;
		if (this.isRichEnabled() && richEl) {
			const next = readEditorSegments(richEl);
			this.draftSegments = next.segments;
			this.draftText = next.text;
		} else if (!this.isRichEnabled() && plainEl) {
			this.draftText = plainEl.value;
			this.draftSegments = createPlainNotesSegments(this.draftText);
		}
		this.isRichEnabled.update((v) => !v);
		queueMicrotask(() => this.seedActiveSurface());
	}

	printNotes(): void {
		const slide = this.slide();
		if (!slide || typeof document === 'undefined') {
			return;
		}
		const html = buildNotesPrintHtml([slide], (n) =>
			this.translate.instant('pptx.notes.slideN', { n }),
		);
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
		document.body.appendChild(frame);
		const doc = frame.contentWindow?.document;
		if (!doc) {
			frame.remove();
			return;
		}
		doc.open();
		doc.write(html);
		doc.close();
		setTimeout(() => {
			frame.contentWindow?.focus();
			frame.contentWindow?.print();
			setTimeout(() => frame.remove(), 1000);
		}, 200);
	}
}
