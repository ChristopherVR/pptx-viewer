/**
 * comment-mention-textarea.component.ts: a plain-text `<textarea>` with an
 * `@`-mention typeahead layered on top, shared by the comments panel's
 * new-comment composer and reply box. Angular port of Vue's
 * `CommentMentionTextarea.vue`.
 *
 * Selector: `pptx-comment-mention-textarea`
 *
 * `text` / `mentions` are plain input()+output() pairs rather than Angular's
 * `model()` two-way binding (unused elsewhere in this package), so the host
 * wires `[text]="draft()" (textChange)="draft.set($event)"` explicitly.
 *
 * @module viewer/comment-mention-textarea
 */
import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';

import { createCommentMentionInput } from './comment-mention-input';

/** The caret a native textarea reports; the text's own length for the rare engine that omits it. */
function caretOf(el: HTMLTextAreaElement): number {
	return el.selectionStart ?? el.value.length;
}

@Component({
	selector: 'pptx-comment-mention-textarea',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-comment-mention">
			<textarea
				#textareaEl
				[class]="textareaClass()"
				[rows]="rows()"
				[placeholder]="placeholder()"
				[attr.aria-label]="ariaLabel() || null"
				[value]="text()"
				(input)="onInput($event)"
				(click)="onCaretMove($event)"
				(keyup)="onCaretMove($event)"
				(keydown)="onKeydown($event)"
				(blur)="mention.close()"
			></textarea>
			@if (mention.isOpen()) {
				<ul data-testid="pptx-comment-mention-suggestions" class="pptx-ng-comment-mention__list">
					@for (author of mention.suggestions(); track author.id; let index = $index) {
						<li
							data-testid="pptx-comment-mention-option"
							class="pptx-ng-comment-mention__option"
							[class.pptx-ng-comment-mention__option--active]="index === mention.activeIndex()"
							(mousedown)="onOptionMouseDown($event, author)"
						>
							{{ author.name }}
						</li>
					}
				</ul>
			}
		</div>
	`,
	styles: `
		.pptx-ng-comment-mention {
			position: relative;
		}
		/* The two call sites' textarea looks (comments-panel.component.ts): kept
		   here, not in the caller's stylesheet, because Angular's per-component
		   style encapsulation means a selector in the CALLER's sheet can never
		   match an element rendered inside THIS component's own template. */
		.pptx-ng-comments__textarea,
		.pptx-ng-comments__reply-textarea {
			resize: vertical;
			width: 100%;
			padding: 8px;
			border-radius: 6px;
			border: 1px solid var(--pptx-border, #374151);
			background: var(--pptx-background, #030712);
			color: inherit;
			font: inherit;
		}
		.pptx-ng-comments__textarea {
			font-size: 13px;
		}
		.pptx-ng-comments__reply-textarea {
			font-size: 12px;
		}
		.pptx-ng-comment-mention__list {
			position: absolute;
			z-index: 10;
			margin: 2px 0 0;
			padding: 4px 0;
			max-height: 160px;
			width: 224px;
			overflow-y: auto;
			list-style: none;
			border: 1px solid var(--pptx-border, #33334d);
			border-radius: 6px;
			background: var(--pptx-popover, #1e1e2e);
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
			font-size: 12px;
		}
		.pptx-ng-comment-mention__option {
			padding: 4px 8px;
			cursor: pointer;
		}
		.pptx-ng-comment-mention__option--active {
			background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
			color: var(--pptx-primary, #6366f1);
		}
	`,
})
export class CommentMentionTextareaComponent {
	readonly text = input.required<string>();
	readonly mentions = input<PptxCommentMention[]>([]);
	readonly authors = input<readonly PptxModernCommentAuthor[]>([]);
	readonly placeholder = input('');
	readonly ariaLabel = input('');
	readonly rows = input(3);
	readonly textareaClass = input('');

	readonly textChange = output<string>();
	readonly mentionsChange = output<PptxCommentMention[]>();

	private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

	protected readonly mention = createCommentMentionInput(() => this.authors());

	protected onInput(event: Event): void {
		const el = event.target as HTMLTextAreaElement;
		this.textChange.emit(el.value);
		this.mention.sync(el.value, caretOf(el));
	}

	/** Re-sync on any caret move that is not itself a text change (click, arrow keys). */
	protected onCaretMove(event: Event): void {
		const el = event.target as HTMLTextAreaElement;
		this.mention.sync(el.value, caretOf(el));
	}

	protected onOptionMouseDown(event: MouseEvent, author: PptxModernCommentAuthor): void {
		event.preventDefault();
		this.applyAccept(author);
	}

	private applyAccept(author?: PptxModernCommentAuthor): void {
		const result = this.mention.accept(this.text(), this.mentions(), author);
		if (!result) {
			return;
		}
		this.textChange.emit(result.text);
		this.mentionsChange.emit(result.mentions);
		queueMicrotask(() => {
			const el = this.textareaEl()?.nativeElement;
			el?.setSelectionRange(result.caret, result.caret);
			el?.focus();
		});
	}

	protected onKeydown(event: KeyboardEvent): void {
		if (!this.mention.isOpen()) {
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			this.mention.moveActive(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			this.mention.moveActive(-1);
		} else if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			this.applyAccept();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.mention.close();
		}
	}
}
