/**
 * comments-panel.component.ts: Side panel listing the active slide's comments.
 *
 * Selector: `pptx-comments-panel`
 *
 * Presentational only: it renders the supplied `comments` (already filtered to
 * the active slide by the host, nested replies included) and surfaces
 * add / remove / resolve / reply intents via outputs. The host owns state and
 * commits history-aware comment-array writes.
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
 *   (reply)="onReplyComment($event)"
 * />
 * ```
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxComment } from 'pptx-viewer-core';
import { formatCommentTimestamp } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-comments-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	templateUrl: './comments-panel.component.html',
	styleUrl: './comments-panel.component.css',
})
export class CommentsPanelComponent {
	// -------------------------------------------------------------------------
	// Inputs / outputs
	// -------------------------------------------------------------------------

	/** The active slide's comments (already filtered to the active slide). */
	readonly comments = input<PptxComment[]>([]);

	private readonly translate = inject(TranslateService);

	/** Display name shown in the compose label ("Commenting as …"). */
	readonly authorName = input<string>(this.translate.instant('pptx.comments.defaultAuthorName'));

	/** Emits the trimmed comment text the user wants to add. */
	readonly add = output<string>();

	/** Emits the id of a comment the user wants to remove. */
	readonly remove = output<string>();

	/** Emits the id of a comment whose resolved flag should toggle. */
	readonly resolve = output<string>();

	/** Emits the parent comment id + trimmed text of a threaded reply. */
	readonly reply = output<{ parentId: string; text: string }>();

	// -------------------------------------------------------------------------
	// Draft state
	// -------------------------------------------------------------------------

	/** Current text typed into the compose textarea. */
	readonly draft = signal('');

	/** Whether the draft has non-whitespace content (enables the submit button). */
	readonly canAdd = computed<boolean>(() => this.draft().trim().length > 0);

	/** Id of the comment whose reply composer is open (one at a time). */
	readonly replyingTo = signal<string | null>(null);

	/** Current text typed into the open reply composer. */
	readonly replyDraft = signal('');

	/** Whether the reply draft has content (enables the reply submit button). */
	readonly canReply = computed<boolean>(() => this.replyDraft().trim().length > 0);

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

	/** Localized reply-composer placeholder ("Reply to <author>..."). */
	replyPlaceholder(comment: PptxComment): string {
		return this.translate.instant('pptx.comments.replyPlaceholder', {
			author: comment.author || this.translate.instant('pptx.comments.unknownAuthor'),
		});
	}

	/** Open the reply composer under `parentId` (closing any other composer). */
	startReply(parentId: string): void {
		this.replyingTo.set(parentId);
		this.replyDraft.set('');
	}

	cancelReply(): void {
		this.replyingTo.set(null);
		this.replyDraft.set('');
	}

	onReplyInput(event: Event): void {
		const target = event.target as HTMLTextAreaElement;
		this.replyDraft.set(target.value);
	}

	submitReply(parentId: string): void {
		const text = this.replyDraft().trim();
		if (text.length === 0) {
			return;
		}
		this.reply.emit({ parentId, text });
		this.cancelReply();
	}

	formatTimestamp(value: string | undefined): string {
		return formatCommentTimestamp(value);
	}
}
