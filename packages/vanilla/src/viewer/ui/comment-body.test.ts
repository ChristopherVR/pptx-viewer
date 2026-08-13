import type { PptxComment, PptxCommentMention } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { renderCommentBody } from './comment-body';
import { createCommentThreadView } from './comment-thread-view';

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';

const mentions: PptxCommentMention[] = [
	{ personId: BOB, authorName: 'Bob Example', startIndex: 3, length: 11 },
];

describe('renderCommentBody', () => {
	it('renders an @-mention as a distinct, attributed span', () => {
		const host = document.createElement('p');
		renderCommentBody(host, 'Hi Bob Example can you check this', mentions);
		const mention = host.querySelector('[data-pptx-comment-mention]');
		expect(mention).not.toBeNull();
		expect(mention?.textContent).toBe('Bob Example');
		expect(mention?.getAttribute('data-pptx-comment-mention')).toBe(BOB);
		expect((mention as HTMLElement).title).toBe('Bob Example');
		expect(mention?.classList.contains('pptx-comment-mention')).toBeTruthy();
		expect(host.textContent).toBe('Hi Bob Example can you check this');
	});

	it('renders a body with no mentions as plain text', () => {
		const host = document.createElement('p');
		renderCommentBody(host, 'Nothing to see');
		expect(host.querySelector('[data-pptx-comment-mention]')).toBeNull();
		expect(host.textContent).toBe('Nothing to see');
	});

	it('never interprets a comment body as markup', () => {
		const host = document.createElement('p');
		renderCommentBody(host, '<b>bold</b>');
		expect(host.querySelector('b')).toBeNull();
		expect(host.textContent).toBe('<b>bold</b>');
	});
});

describe('commentThreadView mentions', () => {
	const comment: PptxComment = {
		id: 'c1',
		text: 'Hi Bob Example can you check this',
		author: 'Alice',
		format: 'modern',
		mentions,
	};

	it('highlights mentions in the threaded comment list', () => {
		const view = createCommentThreadView(document, createTranslator(), {
			addCommentReply: vi.fn(),
			editComment: vi.fn(),
			deleteComment: vi.fn(),
			toggleCommentResolved: vi.fn(),
		});
		view.update([comment], true);
		const mention = view.el.querySelector('[data-pptx-comment-mention]');
		expect(mention?.textContent).toBe('Bob Example');
	});
});
