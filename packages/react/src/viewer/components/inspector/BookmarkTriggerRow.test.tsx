// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import { bookmarkOptionValue } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookmarkTriggerRow } from './BookmarkTriggerRow';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

const video = {
	type: 'media',
	id: 'video',
	mediaType: 'video',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	bookmarks: [
		{ label: 'BM1', time: 0.5 },
		{ label: 'BM2', time: 1.5 },
	],
} as PptxElement;

describe('bookmarkTriggerRow', () => {
	it('lists the slide media bookmarks and reports the chosen one', () => {
		const onChange = vi.fn();
		act(() => {
			root.render(
				<BookmarkTriggerRow
					elements={[video]}
					animation={{
						elementId: 'shape',
						trigger: 'onMediaBookmark',
						triggerShapeId: 'video',
						triggerBookmark: 'BM1',
					}}
					canEdit
					onChange={onChange}
				/>,
			);
		});
		const select = container.querySelector('[data-pptx-animation-bookmark-picker]')!;
		const options = [...select.querySelectorAll('option')];
		expect(options.map((o) => o.textContent)).toStrictEqual([
			'pptx.animation.trigger.selectBookmark',
			'BM1',
			'BM2',
		]);
		expect((select as HTMLSelectElement).value).toBe(bookmarkOptionValue('video', 'BM1'));

		(select as HTMLSelectElement).value = bookmarkOptionValue('video', 'BM2');
		act(() => {
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onChange).toHaveBeenCalledWith(bookmarkOptionValue('video', 'BM2'));
	});

	it('says so, disabled, when the slide has no media bookmarks', () => {
		act(() => {
			root.render(
				<BookmarkTriggerRow
					elements={[]}
					animation={{ elementId: 'shape', trigger: 'onMediaBookmark' }}
					canEdit
					onChange={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('[data-pptx-animation-bookmark-picker]')!;
		expect(select.textContent).toBe('pptx.animation.trigger.noBookmarks');
		expect((select as HTMLSelectElement).disabled).toBeTruthy();
	});
});
