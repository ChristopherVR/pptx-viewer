// @vitest-environment happy-dom
import type { PptxCommentMention } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommentBody } from './CommentBody';

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';

const mentions: PptxCommentMention[] = [
	{ personId: BOB, authorName: 'Bob Example', startIndex: 3, length: 11 },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe('commentBody', () => {
	it('renders an @-mention as a distinct, attributed span', () => {
		act(() => {
			root.render(<CommentBody text='Hi Bob Example can you check this' mentions={mentions} />);
		});
		const mention = container.querySelector('[data-pptx-comment-mention]');
		expect(mention).not.toBeNull();
		expect(mention?.textContent).toBe('Bob Example');
		expect(mention?.getAttribute('data-pptx-comment-mention')).toBe(BOB);
		expect(mention?.getAttribute('title')).toBe('Bob Example');
		expect(mention?.className).toContain('pptx-comment-mention');
		expect(container.textContent).toBe('Hi Bob Example can you check this');
	});

	it('renders a body with no mentions as plain text', () => {
		act(() => {
			root.render(<CommentBody text='Nothing to see' />);
		});
		expect(container.querySelector('[data-pptx-comment-mention]')).toBeNull();
		expect(container.textContent).toBe('Nothing to see');
	});
});
