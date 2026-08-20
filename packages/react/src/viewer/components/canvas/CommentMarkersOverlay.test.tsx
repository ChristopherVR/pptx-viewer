// @vitest-environment happy-dom
/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxComment } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentMarkersOverlay } from './CommentMarkersOverlay';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => (key === 'pptx.comments.unknownAuthor' ? 'Unknown' : key),
	}),
}));

const CANVAS = { width: 960, height: 540 };

const comment = (overrides: Partial<PptxComment> = {}): PptxComment =>
	({
		id: 'c1',
		text: 'Check this',
		author: 'Alice',
		...overrides,
	}) as PptxComment;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function render(comments: PptxComment[], onCommentMarkerClick?: (id: string) => void): void {
	act(() => {
		root.render(
			<CommentMarkersOverlay
				comments={comments}
				canvasSize={CANVAS}
				onCommentMarkerClick={onCommentMarkerClick}
			/>,
		);
	});
}

describe('commentMarkersOverlay', () => {
	it('numbers markers 1-based and sets the "<author>: <text>" tooltip', () => {
		render([comment(), comment({ id: 'c2', text: 'Second', author: 'Bob' })]);
		const dots = container.querySelectorAll('[title]');
		expect(dots).toHaveLength(2);
		expect(dots[0]?.textContent).toBe('1');
		expect(dots[0]?.getAttribute('title')).toBe('Alice: Check this');
		expect(dots[1]?.textContent).toBe('2');
		expect(dots[1]?.getAttribute('title')).toBe('Bob: Second');
	});

	it('falls back to the localized "Unknown" author, matching the other bindings', () => {
		render([comment({ author: undefined })]);
		const dot = container.querySelector('[title]');
		expect(dot?.getAttribute('title')).toBe('Unknown: Check this');
	});

	it('invokes onCommentMarkerClick with the comment id', () => {
		const onCommentMarkerClick = vi.fn();
		render([comment()], onCommentMarkerClick);
		const dot = container.querySelector('[title]') as HTMLElement;
		act(() => {
			dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(onCommentMarkerClick).toHaveBeenCalledWith('c1');
	});
});
