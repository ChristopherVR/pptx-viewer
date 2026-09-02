import type { PptxModernCommentAuthor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CommentComposeState } from './comment-compose.svelte';

/**
 * `CommentComposeState` (wave-4 B5): the `@`-mention typeahead's query,
 * matching and accept logic. `.svelte.test.ts` so the runes fields compile.
 */

const ALICE: PptxModernCommentAuthor = {
	id: 'a1',
	name: 'Alice',
	userId: 'u1',
	providerId: 'p1',
};
const BOB: PptxModernCommentAuthor = { id: 'a2', name: 'Bob', userId: 'u2', providerId: 'p1' };
const AUTHORS = [ALICE, BOB];

describe('commentComposeState', () => {
	it('has no query and no suggestions before an @ is typed', () => {
		const state = new CommentComposeState();
		state.onInput('hello there', 11);
		expect(state.query).toBeNull();
		expect(state.suggestions(AUTHORS)).toStrictEqual([]);
	});

	it('matches an author by a partial @-token', () => {
		const state = new CommentComposeState();
		state.onInput('hey @al', 7);
		expect(state.query).toBe('al');
		expect(state.suggestions(AUTHORS)).toStrictEqual([ALICE]);
	});

	it('accepting an author inserts the mention and records it', () => {
		const state = new CommentComposeState();
		state.onInput('hey @al', 7);
		const caret = state.accept(ALICE);
		expect(state.text).toBe('hey @Alice ');
		expect(caret).toBe(state.text.length);
		expect(state.mentions).toHaveLength(1);
		expect(state.mentions[0]).toMatchObject({ personId: 'a1', authorName: 'Alice', startIndex: 4 });
		// The query closes once the mention is inserted (the @-token is gone).
		expect(state.query).toBeNull();
	});

	it('escape dismisses the popup for the current query without clearing the text', () => {
		const state = new CommentComposeState();
		state.onInput('hey @al', 7);
		expect(state.query).toBe('al');
		const result = state.onKeydown({ key: 'Escape' }, AUTHORS);
		expect(result.consumed).toBeTruthy();
		expect(state.query).toBeNull();
		expect(state.text).toBe('hey @al');
	});

	it('arrowDown/ArrowUp cycle the highlighted suggestion', () => {
		const state = new CommentComposeState();
		state.onInput('@', 1);
		expect(state.suggestions(AUTHORS)).toStrictEqual(AUTHORS);
		expect(state.highlightIndex).toBe(0);
		state.onKeydown({ key: 'ArrowDown' }, AUTHORS);
		expect(state.highlightIndex).toBe(1);
		state.onKeydown({ key: 'ArrowUp' }, AUTHORS);
		expect(state.highlightIndex).toBe(0);
	});

	it('enter accepts the highlighted suggestion', () => {
		const state = new CommentComposeState();
		state.onInput('@', 1);
		state.onKeydown({ key: 'ArrowDown' }, AUTHORS); // highlight Bob
		const result = state.onKeydown({ key: 'Enter' }, AUTHORS);
		expect(result.consumed).toBeTruthy();
		expect(state.text).toBe('@Bob ');
	});

	it('reset clears text, mentions, and the dismissed/highlight state', () => {
		const state = new CommentComposeState();
		state.onInput('hey @al', 7);
		state.accept(ALICE);
		state.reset();
		expect(state.text).toBe('');
		expect(state.mentions).toStrictEqual([]);
	});
});
