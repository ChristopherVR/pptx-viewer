import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { replyToCommentInList } from './comments-list';

const parent = (overrides: Partial<PptxComment> = {}): PptxComment => ({
	id: 'parent-1',
	text: 'Top-level comment',
	author: 'Alice',
	resolved: false,
	...overrides,
});

describe('replyToCommentInList', () => {
	it('nests the reply under the parent with threading metadata', () => {
		const next = replyToCommentInList([parent()], 'parent-1', '  A reply  ', 'Bob');
		expect(next).not.toBeNull();
		const replies = next![0].replies;
		expect(replies).toHaveLength(1);
		expect(replies![0]).toMatchObject({
			text: 'A reply',
			author: 'Bob',
			threadId: 'parent-1',
			parentId: 'parent-1',
		});
		expect(replies![0].id).toBeTruthy();
		expect(replies![0].createdAt).toBeTruthy();
	});

	it('appends to existing replies without mutating the input', () => {
		const existingReply: PptxComment = { id: 'r1', text: 'First', parentId: 'parent-1' };
		const input = [parent({ replies: [existingReply] })];
		const next = replyToCommentInList(input, 'parent-1', 'Second', 'Bob');
		expect(next![0].replies).toHaveLength(2);
		expect(next![0].replies![0]).toBe(existingReply);
		expect(input[0].replies).toHaveLength(1);
	});

	it('inherits the parent elementId anchor', () => {
		const next = replyToCommentInList([parent({ elementId: 'shape-9' })], 'parent-1', 'Hi', 'Bob');
		expect(next![0].replies![0].elementId).toBe('shape-9');
	});

	it('returns null for blank text or an unknown parent', () => {
		expect(replyToCommentInList([parent()], 'parent-1', '   ', 'Bob')).toBeNull();
		expect(replyToCommentInList([parent()], 'missing', 'Hi', 'Bob')).toBeNull();
	});
});
