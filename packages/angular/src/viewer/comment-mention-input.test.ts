import type { PptxModernCommentAuthor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createCommentMentionInput } from './comment-mention-input';

const ALICE: PptxModernCommentAuthor = {
	id: 'author-1',
	name: 'Alice',
	userId: 'u1',
	providerId: 'p1',
};
const BOB: PptxModernCommentAuthor = {
	id: 'author-2',
	name: 'Bob',
	userId: 'u2',
	providerId: 'p1',
};

describe('createCommentMentionInput', () => {
	it('lists a matching author and stays closed with no @-token', () => {
		const mention = createCommentMentionInput(() => [ALICE, BOB]);
		expect(mention.isOpen()).toBeFalsy();

		mention.sync('hi @al', 6);
		expect(mention.isOpen()).toBeTruthy();
		expect(mention.suggestions().map((a) => a.name)).toStrictEqual(['Alice']);
	});

	it('accepting inserts "@Alice " and one mention with the right startIndex/length', () => {
		const mention = createCommentMentionInput(() => [ALICE, BOB]);
		mention.sync('hi @al', 6);
		const result = mention.accept('hi @al', [], undefined);
		expect(result).not.toBeNull();
		expect(result?.text).toBe('hi @Alice ');
		expect(result?.mentions).toStrictEqual([
			{
				id: expect.any(String),
				personId: 'author-1',
				authorName: 'Alice',
				startIndex: 3,
				length: 6,
			},
		]);
		expect(result?.caret).toBe(10);
	});

	it('accept closes the list', () => {
		const mention = createCommentMentionInput(() => [ALICE]);
		mention.sync('@al', 3);
		mention.accept('@al', []);
		expect(mention.isOpen()).toBeFalsy();
	});

	it('moveActive cycles through suggestions and wraps', () => {
		const mention = createCommentMentionInput(() => [ALICE, BOB]);
		mention.sync('@', 1);
		expect(mention.activeIndex()).toBe(0);
		mention.moveActive(1);
		expect(mention.activeIndex()).toBe(1);
		mention.moveActive(1);
		expect(mention.activeIndex()).toBe(0);
		mention.moveActive(-1);
		expect(mention.activeIndex()).toBe(1);
	});

	it('accept with an explicit author overrides the highlighted suggestion', () => {
		const mention = createCommentMentionInput(() => [ALICE, BOB]);
		mention.sync('@', 1);
		const result = mention.accept('@', [], BOB);
		expect(result?.text).toBe('@Bob ');
	});

	it('close clears the query and resets the active index', () => {
		const mention = createCommentMentionInput(() => [ALICE, BOB]);
		mention.sync('@', 1);
		mention.moveActive(1);
		mention.close();
		expect(mention.isOpen()).toBeFalsy();
		expect(mention.activeIndex()).toBe(0);
	});

	it('accept returns null when there is nothing to accept', () => {
		const mention = createCommentMentionInput(() => []);
		expect(mention.accept('hello', [])).toBeNull();
	});
});
