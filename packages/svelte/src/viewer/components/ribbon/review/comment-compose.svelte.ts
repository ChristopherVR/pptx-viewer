import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import {
	commentMentionQuery,
	insertCommentMention,
	matchCommentMentionAuthors,
} from 'pptx-viewer-shared';

/**
 * CommentComposeState: the `@`-mention typeahead over ONE comment/reply
 * composer's draft (wave-4 B5). A runes class rather than inline component
 * state so `ReviewCommentsPanel` can hold two independent instances (the
 * new-comment composer and whichever reply composer is open) without
 * duplicating the query/keyboard-nav logic.
 *
 * The query itself, the author match, and the actual text/mentions splice are
 * all pure shared helpers (`render/comment-mentions`); this class only tracks
 * the caret, the open/dismissed state, and the highlighted suggestion.
 */
export class CommentComposeState {
	text = $state('');
	mentions = $state<PptxCommentMention[]>([]);
	#caret = $state(0);
	/** Escape dismisses the popup for the CURRENT query; typing re-opens it. */
	#dismissedAtCaret = $state<number | null>(null);
	highlightIndex = $state(0);

	/** The active `@`-token at the caret, or `null` when none / dismissed. */
	get query(): string | null {
		if (this.#dismissedAtCaret === this.#caret) {
			return null;
		}
		return commentMentionQuery(this.text, this.#caret)?.query ?? null;
	}

	/** Matching authors for the current query, best-first. */
	suggestions(authors: readonly PptxModernCommentAuthor[]): PptxModernCommentAuthor[] {
		const query = this.query;
		return query === null ? [] : matchCommentMentionAuthors([...authors], query);
	}

	/** Reset the whole composer (after a successful submit, or opening a new one). */
	reset(): void {
		this.text = '';
		this.mentions = [];
		this.#caret = 0;
		this.#dismissedAtCaret = null;
		this.highlightIndex = 0;
	}

	/** The textarea's value + caret changed (input, click, arrow keys, ...). */
	onInput(value: string, caret: number): void {
		this.text = value;
		this.#caret = caret;
		this.#dismissedAtCaret = null;
		this.highlightIndex = 0;
	}

	/**
	 * Keyboard handling while the suggestion list is open. Returns `true` when
	 * the key was consumed (the caller should `preventDefault()` and, for
	 * `accepted`, apply the caret it returns to the textarea).
	 */
	onKeydown(
		event: { key: string },
		authors: readonly PptxModernCommentAuthor[],
	): { consumed: boolean; caret?: number } {
		const list = this.suggestions(authors);
		if (list.length === 0) {
			return { consumed: false };
		}
		if (event.key === 'ArrowDown') {
			this.highlightIndex = (this.highlightIndex + 1) % list.length;
			return { consumed: true };
		}
		if (event.key === 'ArrowUp') {
			this.highlightIndex = (this.highlightIndex - 1 + list.length) % list.length;
			return { consumed: true };
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			const author = list[this.highlightIndex] ?? list[0];
			const caret = this.accept(author);
			return { consumed: true, caret };
		}
		if (event.key === 'Escape') {
			this.#dismissedAtCaret = this.#caret;
			return { consumed: true };
		}
		return { consumed: false };
	}

	/** Accept one author from the list (click or keyboard); returns the new caret. */
	accept(author: PptxModernCommentAuthor): number {
		const result = insertCommentMention(this.text, this.mentions, this.#caret, author);
		this.text = result.text;
		this.mentions = result.mentions;
		this.#caret = result.caret;
		this.#dismissedAtCaret = null;
		this.highlightIndex = 0;
		return result.caret;
	}
}
