import type { PptxComment, PptxCommentMention } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { withMentionsOnLast, withMentionsOnLastReply } from './comments-mentions-patch';

function comment(id: string, replies?: PptxComment[]): PptxComment {
	return { id, text: `text-${id}`, ...(replies ? { replies } : {}) };
}

const MENTION: PptxCommentMention = {
	id: 'm1',
	personId: 'author-1',
	authorName: 'Alice',
	startIndex: 0,
	length: 6,
};

describe('withMentionsOnLast', () => {
	it('patches mentions onto the last comment (the one just appended)', () => {
		const next = withMentionsOnLast([comment('a'), comment('b')], [MENTION]);
		expect(next[0].mentions).toBeUndefined();
		expect(next[1].mentions).toStrictEqual([MENTION]);
	});

	it('returns the array unchanged when there are no mentions to patch', () => {
		const comments = [comment('a')];
		expect(withMentionsOnLast(comments, [])).toBe(comments);
	});

	it('returns the array unchanged for an empty list', () => {
		expect(withMentionsOnLast([], [MENTION])).toStrictEqual([]);
	});
});

describe('withMentionsOnLastReply', () => {
	it("patches mentions onto the parent's last reply", () => {
		const parent = comment('p1', [comment('r1'), comment('r2')]);
		const next = withMentionsOnLastReply([parent], 'p1', [MENTION]);
		const patched = next[0];
		expect(patched.replies?.[0].mentions).toBeUndefined();
		expect(patched.replies?.[1].mentions).toStrictEqual([MENTION]);
	});

	it('leaves other comments untouched', () => {
		const other = comment('other', [comment('r1')]);
		const parent = comment('p1', [comment('r1')]);
		const next = withMentionsOnLastReply([other, parent], 'p1', [MENTION]);
		expect(next[0].replies?.[0].mentions).toBeUndefined();
		expect(next[1].replies?.[0].mentions).toStrictEqual([MENTION]);
	});

	it('no-ops when the parent has no replies', () => {
		const parent = comment('p1');
		const next = withMentionsOnLastReply([parent], 'p1', [MENTION]);
		expect(next[0]).toStrictEqual(parent);
	});

	it('returns the array unchanged when there are no mentions to patch', () => {
		const comments = [comment('p1', [comment('r1')])];
		expect(withMentionsOnLastReply(comments, 'p1', [])).toBe(comments);
	});
});
