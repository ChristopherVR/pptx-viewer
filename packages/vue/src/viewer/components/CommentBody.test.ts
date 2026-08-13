import { mount } from '@vue/test-utils';
import type { PptxComment, PptxCommentMention } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import CommentBody from './CommentBody.vue';
import CommentsPanel from './CommentsPanel.vue';

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';

const mentions: PptxCommentMention[] = [
	{ personId: BOB, authorName: 'Bob Example', startIndex: 3, length: 11 },
];

describe('commentBody', () => {
	it('renders an @-mention as a distinct, attributed span', () => {
		const wrapper = mount(CommentBody, {
			props: { text: 'Hi Bob Example can you check this', mentions },
		});
		const mention = wrapper.find('[data-pptx-comment-mention]');
		expect(mention.exists()).toBeTruthy();
		expect(mention.text()).toBe('Bob Example');
		expect(mention.attributes('data-pptx-comment-mention')).toBe(BOB);
		expect(mention.attributes('title')).toBe('Bob Example');
		expect(mention.classes()).toContain('pptx-comment-mention');
		expect(wrapper.text()).toBe('Hi Bob Example can you check this');
	});

	it('renders a body with no mentions as plain text', () => {
		const wrapper = mount(CommentBody, { props: { text: 'Nothing to see' } });
		expect(wrapper.find('[data-pptx-comment-mention]').exists()).toBeFalsy();
		expect(wrapper.text()).toBe('Nothing to see');
	});
});

describe('commentsPanel mentions', () => {
	const comment: PptxComment = {
		id: 'c1',
		text: 'Hi Bob Example can you check this',
		author: 'Alice',
		createdAt: '2024-06-01T10:00:00Z',
		format: 'modern',
		mentions,
	};

	it('highlights mentions in a top-level comment', () => {
		const wrapper = mount(CommentsPanel, { props: { comments: [comment], authorName: 'You' } });
		expect(wrapper.find('[data-pptx-comment-mention]').text()).toBe('Bob Example');
	});

	it('highlights mentions in a reply', () => {
		const parent: PptxComment = {
			...comment,
			mentions: undefined,
			text: 'Root',
			replies: [{ ...comment, id: 'r1' }],
		};
		const wrapper = mount(CommentsPanel, { props: { comments: [parent], authorName: 'You' } });
		expect(wrapper.find('[data-pptx-comment-mention]').text()).toBe('Bob Example');
	});
});
