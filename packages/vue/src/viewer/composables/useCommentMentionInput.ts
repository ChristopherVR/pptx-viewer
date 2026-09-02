/**
 * useCommentMentionInput: the `@`-mention typeahead behind a comment/reply
 * textarea.
 *
 * A thin reactive wrapper over the shared, framework-neutral rule
 * (`commentMentionQuery`, `matchCommentMentionAuthors`, `insertCommentMention`
 * in `pptx-viewer-shared`), so the composer/reply editors need only wire DOM
 * events into it rather than re-deriving the caret math themselves. One
 * instance per editor: `CommentsPanel.vue` holds one for the new-comment
 * composer and one shared instance for whichever reply box is open (only one
 * can be open at a time).
 */
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import type { CommentMentionInsertion, CommentMentionQuery } from 'pptx-viewer-shared';
import {
	commentMentionQuery,
	insertCommentMention,
	matchCommentMentionAuthors,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export interface UseCommentMentionInputInput {
	/** The authors the typeahead offers, read live (deck may still be loading). */
	authors: () => PptxModernCommentAuthor[];
}

export interface UseCommentMentionInputResult {
	/** Authors matching the in-progress `@`-token, best match first. */
	suggestions: ComputedRef<PptxModernCommentAuthor[]>;
	/** Whether the suggestion list should be shown. */
	isOpen: ComputedRef<boolean>;
	/** Index into `suggestions` the keyboard has highlighted. */
	activeIndex: Ref<number>;
	/**
	 * Re-derive the `@`-token from the textarea's current text and caret.
	 * Call on every `input`/`click`/`keyup` so the caret this composable
	 * remembers never goes stale before {@link accept} reads it back.
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

export function useCommentMentionInput(
	input: UseCommentMentionInputInput,
): UseCommentMentionInputResult {
	const query = ref<CommentMentionQuery | null>(null);
	const lastCaret = ref(0);
	const activeIndex = ref(0);

	const suggestions = computed<PptxModernCommentAuthor[]>(() =>
		query.value ? matchCommentMentionAuthors(input.authors(), query.value.query) : [],
	);
	const isOpen = computed(() => suggestions.value.length > 0);

	function sync(text: string, caret: number): void {
		lastCaret.value = caret;
		query.value = commentMentionQuery(text, caret);
		activeIndex.value = 0;
	}

	function moveActive(direction: 1 | -1): void {
		const count = suggestions.value.length;
		if (count === 0) {
			return;
		}
		activeIndex.value = (activeIndex.value + direction + count) % count;
	}

	function accept(
		text: string,
		mentions: PptxCommentMention[] | undefined,
		author?: PptxModernCommentAuthor,
	): CommentMentionInsertion | null {
		const picked = author ?? suggestions.value[activeIndex.value];
		if (!picked) {
			return null;
		}
		const result = insertCommentMention(text, mentions, lastCaret.value, picked);
		close();
		return result;
	}

	function close(): void {
		query.value = null;
		activeIndex.value = 0;
	}

	return { suggestions, isOpen, activeIndex, sync, moveActive, accept, close };
}
