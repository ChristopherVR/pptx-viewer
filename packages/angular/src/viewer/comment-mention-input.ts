/**
 * comment-mention-input.ts: the `@`-mention typeahead behind a comment/reply
 * textarea.
 *
 * A thin signal-based wrapper over the shared, framework-neutral rule
 * (`commentMentionQuery`, `matchCommentMentionAuthors`, `insertCommentMention`
 * in `pptx-viewer-shared`), Angular port of Vue's `useCommentMentionInput`
 * composable, so `CommentMentionTextareaComponent` needs only wire DOM events
 * into it rather than re-deriving the caret math itself. One instance per
 * editor: the new-comment composer and the (single, shared) reply composer
 * each hold their own.
 *
 * @module viewer/comment-mention-input
 */
import { computed, signal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';

import type { CommentMentionInsertion, CommentMentionQuery } from '../internal/shared';
import {
	commentMentionQuery,
	insertCommentMention,
	matchCommentMentionAuthors,
} from '../internal/shared';

export interface CommentMentionInput {
	/** Authors matching the in-progress `@`-token, best match first. */
	readonly suggestions: Signal<PptxModernCommentAuthor[]>;
	/** Whether the suggestion list should be shown. */
	readonly isOpen: Signal<boolean>;
	/** Index into `suggestions` the keyboard has highlighted. */
	readonly activeIndex: WritableSignal<number>;
	/**
	 * Re-derive the `@`-token from the textarea's current text and caret. Call
	 * on every `input`/`click`/`keyup` so the caret this helper remembers never
	 * goes stale before {@link accept} reads it back.
	 */
	sync: (text: string, caret: number) => void;
	/** ArrowUp (`-1`) / ArrowDown (`1`) through the open suggestion list. */
	moveActive: (direction: 1 | -1) => void;
	/**
	 * Accept a suggestion (the highlighted one when `author` is omitted, as
	 * Enter/Tab do; an explicit one for a click). Returns `null` when there is
	 * nothing to accept (list closed, or an empty list with no explicit pick).
	 */
	accept: (
		text: string,
		mentions: PptxCommentMention[] | undefined,
		author?: PptxModernCommentAuthor,
	) => CommentMentionInsertion | null;
	/** Close the suggestion list without accepting (Escape, blur). */
	close: () => void;
}

export function createCommentMentionInput(
	authors: () => readonly PptxModernCommentAuthor[],
): CommentMentionInput {
	const query = signal<CommentMentionQuery | null>(null);
	let lastCaret = 0;
	const activeIndex = signal(0);

	const suggestions = computed<PptxModernCommentAuthor[]>(() => {
		const current = query();
		return current ? matchCommentMentionAuthors([...authors()], current.query) : [];
	});
	const isOpen = computed(() => suggestions().length > 0);

	function sync(text: string, caret: number): void {
		lastCaret = caret;
		query.set(commentMentionQuery(text, caret));
		activeIndex.set(0);
	}

	function moveActive(direction: 1 | -1): void {
		const count = suggestions().length;
		if (count === 0) {
			return;
		}
		activeIndex.set((activeIndex() + direction + count) % count);
	}

	function accept(
		text: string,
		mentions: PptxCommentMention[] | undefined,
		author?: PptxModernCommentAuthor,
	): CommentMentionInsertion | null {
		const picked = author ?? suggestions()[activeIndex()];
		if (!picked) {
			return null;
		}
		const result = insertCommentMention(text, mentions, lastCaret, picked);
		close();
		return result;
	}

	function close(): void {
		query.set(null);
		activeIndex.set(0);
	}

	return { suggestions, isOpen, activeIndex, sync, moveActive, accept, close };
}
