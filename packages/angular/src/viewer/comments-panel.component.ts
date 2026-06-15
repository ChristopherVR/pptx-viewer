/**
 * comments-panel.component.ts — Side panel listing the active slide's comments.
 *
 * Selector: `pptx-comments-panel`
 *
 * Presentational only: it renders the supplied `comments` (already filtered to
 * the active slide by the host) and surfaces add / remove / resolve intents via
 * outputs. The host owns state and commits history-aware comment-array writes.
 *
 * Timestamps are formatted with the core `formatCommentTimestamp` helper so the
 * Angular binding matches the React/Vue formatting exactly.
 *
 * Usage:
 * ```html
 * <pptx-comments-panel
 *   [comments]="slideComments()"
 *   [authorName]="userName()"
 *   (add)="onAddComment($event)"
 *   (remove)="onRemoveComment($event)"
 *   (resolve)="onResolveComment($event)"
 * />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { PptxComment } from 'pptx-viewer-core';
import { formatCommentTimestamp } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-comments-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<aside class="pptx-ng-comments" aria-label="Slide comments">
			<header class="pptx-ng-comments__header">
				<h2 class="pptx-ng-comments__title">Comments</h2>
				<span class="pptx-ng-comments__count" data-testid="comment-count">
					{{ comments().length }}
				</span>
			</header>

			@if (comments().length > 0) {
				<ul class="pptx-ng-comments__list">
					@for (comment of comments(); track comment.id) {
						<li
							class="pptx-ng-comments__item"
							[class.pptx-ng-comments__item--resolved]="comment.resolved"
							[attr.data-comment-id]="comment.id"
						>
							<div class="pptx-ng-comments__meta">
								<span class="pptx-ng-comments__author">{{ comment.author || 'Unknown' }}</span>
								@if (formatTimestamp(comment.createdAt); as ts) {
									<time class="pptx-ng-comments__time">{{ ts }}</time>
								}
							</div>
							<p class="pptx-ng-comments__text">{{ comment.text }}</p>
							<div class="pptx-ng-comments__actions">
								<button
									type="button"
									class="pptx-ng-comments__action"
									[attr.data-comment-id]="comment.id"
									[attr.aria-pressed]="comment.resolved ? 'true' : 'false'"
									(click)="resolve.emit(comment.id)"
								>
									{{ comment.resolved ? 'Reopen' : 'Resolve' }}
								</button>
								<button
									type="button"
									class="pptx-ng-comments__action pptx-ng-comments__action--danger"
									[attr.data-comment-id]="comment.id"
									aria-label="Remove comment"
									(click)="remove.emit(comment.id)"
								>
									Remove
								</button>
							</div>
						</li>
					}
				</ul>
			} @else {
				<p class="pptx-ng-comments__empty" data-testid="comments-empty">
					No comments on this slide yet.
				</p>
			}

			<form class="pptx-ng-comments__compose" (submit)="submit($event)">
				<label class="pptx-ng-comments__compose-label" [title]="'Commenting as ' + authorName()">
					Add comment
				</label>
				<textarea
					class="pptx-ng-comments__textarea"
					rows="3"
					placeholder="Write a comment…"
					aria-label="Add comment"
					[value]="draft()"
					(input)="onDraftInput($event)"
				></textarea>
				<button
					type="submit"
					class="pptx-ng-comments__submit"
					[disabled]="!canAdd()"
					data-testid="add-comment"
				>
					Add comment
				</button>
			</form>
		</aside>
	`,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
				width: 100%;
			}

			.pptx-ng-comments {
				display: flex;
				flex-direction: column;
				min-height: 0;
				height: 100%;
				width: 100%;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				border-left: 1px solid var(--pptx-border, #374151);
				font-family: system-ui, sans-serif;
			}

			.pptx-ng-comments__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--pptx-border, #374151);
			}

			.pptx-ng-comments__title {
				margin: 0;
				font-size: 14px;
				font-weight: 600;
			}

			.pptx-ng-comments__count {
				font-size: 12px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-comments__list {
				list-style: none;
				margin: 0;
				padding: 8px;
				overflow-y: auto;
				flex: 1 1 auto;
				min-height: 0;
			}

			.pptx-ng-comments__item {
				padding: 10px 12px;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 8px;
				margin-bottom: 8px;
			}

			.pptx-ng-comments__item--resolved {
				opacity: 0.6;
			}

			.pptx-ng-comments__meta {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: 8px;
				margin-bottom: 4px;
			}

			.pptx-ng-comments__author {
				font-size: 13px;
				font-weight: 600;
			}

			.pptx-ng-comments__time {
				font-size: 11px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-comments__text {
				margin: 0 0 8px;
				font-size: 13px;
				white-space: pre-wrap;
				word-break: break-word;
			}

			.pptx-ng-comments__actions {
				display: flex;
				gap: 8px;
			}

			.pptx-ng-comments__action {
				font-size: 12px;
				padding: 4px 8px;
				border-radius: 6px;
				border: 1px solid var(--pptx-border, #374151);
				background: transparent;
				color: inherit;
				cursor: pointer;
			}

			.pptx-ng-comments__action--danger {
				color: #f87171;
			}

			.pptx-ng-comments__empty {
				padding: 16px;
				font-size: 13px;
				color: var(--pptx-muted-foreground, #9ca3af);
				flex: 1 1 auto;
			}

			.pptx-ng-comments__compose {
				display: flex;
				flex-direction: column;
				gap: 8px;
				padding: 12px 16px;
				border-top: 1px solid var(--pptx-border, #374151);
			}

			.pptx-ng-comments__compose-label {
				font-size: 12px;
				font-weight: 600;
			}

			.pptx-ng-comments__textarea {
				resize: vertical;
				width: 100%;
				padding: 8px;
				border-radius: 6px;
				border: 1px solid var(--pptx-border, #374151);
				background: var(--pptx-background, #030712);
				color: inherit;
				font: inherit;
				font-size: 13px;
			}

			.pptx-ng-comments__submit {
				align-self: flex-end;
				font-size: 13px;
				padding: 6px 14px;
				border-radius: 6px;
				border: none;
				background: var(--pptx-primary, #6366f1);
				color: #fff;
				cursor: pointer;
			}

			.pptx-ng-comments__submit:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		`,
	],
})
export class CommentsPanelComponent {
	// -------------------------------------------------------------------------
	// Inputs / outputs
	// -------------------------------------------------------------------------

	/** The active slide's comments (already filtered to the active slide). */
	readonly comments = input<PptxComment[]>([]);

	/** Display name shown in the compose label ("Commenting as …"). */
	readonly authorName = input<string>('You');

	/** Emits the trimmed comment text the user wants to add. */
	readonly add = output<string>();

	/** Emits the id of a comment the user wants to remove. */
	readonly remove = output<string>();

	/** Emits the id of a comment whose resolved flag should toggle. */
	readonly resolve = output<string>();

	// -------------------------------------------------------------------------
	// Draft state
	// -------------------------------------------------------------------------

	/** Current text typed into the compose textarea. */
	readonly draft = signal('');

	/** Whether the draft has non-whitespace content (enables the submit button). */
	readonly canAdd = computed<boolean>(() => this.draft().trim().length > 0);

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	onDraftInput(event: Event): void {
		const target = event.target as HTMLTextAreaElement;
		this.draft.set(target.value);
	}

	submit(event: Event): void {
		event.preventDefault();
		const text = this.draft().trim();
		if (text.length === 0) {
			return;
		}
		this.add.emit(text);
		this.draft.set('');
	}

	formatTimestamp(value: string | undefined): string {
		return formatCommentTimestamp(value);
	}
}
