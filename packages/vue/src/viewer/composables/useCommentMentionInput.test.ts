import type { PptxModernCommentAuthor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { useCommentMentionInput } from './useCommentMentionInput';

const AUTHORS: PptxModernCommentAuthor[] = [
	{ id: '{A}', name: 'Alice', initials: 'AL' },
	{ id: '{B}', name: 'Bob', initials: 'BB' },
];

/**
 * useCommentMentionInput: the `@`-mention typeahead behind a comment/reply
 * textarea (wave-4 B5). A thin reactive wrapper over the shared rule; these
 * tests exercise the wiring (sync -> suggestions -> accept), not the shared
 * matching/insertion logic itself (covered in `pptx-viewer-shared`).
 */
describe('useCommentMentionInput', () => {
	it('lists a matching author while a token is being typed', () => {
		const mention = useCommentMentionInput({ authors: () => AUTHORS });
		mention.sync('@al', 3);
		expect(mention.isOpen.value).toBeTruthy();
		expect(mention.suggestions.value.map((a) => a.name)).toStrictEqual(['Alice']);
	});

	it('closes when the caret leaves the token', () => {
		const mention = useCommentMentionInput({ authors: () => AUTHORS });
		mention.sync('@al', 3);
		expect(mention.isOpen.value).toBeTruthy();
		mention.sync('@al ', 4);
		expect(mention.isOpen.value).toBeFalsy();
	});

	it('accepting inserts "@Alice " and one mention with the right startIndex/length', () => {
		const mention = useCommentMentionInput({ authors: () => AUTHORS });
		const text = 'hey @al';
		mention.sync(text, text.length);
		const result = mention.accept(text, undefined);
		expect(result).not.toBeNull();
		expect(result?.text).toBe('hey @Alice ');
		expect(result?.mentions).toHaveLength(1);
		expect(result?.mentions[0]).toMatchObject({
			personId: '{A}',
			authorName: 'Alice',
			startIndex: 4,
			length: '@Alice'.length,
		});
	});

	it('arrowDown/arrowUp wrap through the suggestion list', () => {
		const authors: PptxModernCommentAuthor[] = [
			{ id: '{A}', name: 'Alice' },
			{ id: '{A2}', name: 'Alicia' },
		];
		const mention = useCommentMentionInput({ authors: () => authors });
		mention.sync('@ali', 4);
		expect(mention.activeIndex.value).toBe(0);
		mention.moveActive(1);
		expect(mention.activeIndex.value).toBe(1);
		mention.moveActive(1);
		expect(mention.activeIndex.value).toBe(0);
		mention.moveActive(-1);
		expect(mention.activeIndex.value).toBe(1);
	});

	it('accept returns null when nothing is open', () => {
		const mention = useCommentMentionInput({ authors: () => AUTHORS });
		expect(mention.accept('no mention here', undefined)).toBeNull();
	});

	it('close clears the open suggestion list', () => {
		const mention = useCommentMentionInput({ authors: () => AUTHORS });
		mention.sync('@al', 3);
		expect(mention.isOpen.value).toBeTruthy();
		mention.close();
		expect(mention.isOpen.value).toBeFalsy();
	});
});
