// @vitest-environment happy-dom
/**
 * Two find-bar defects that only show up with the real hook wired to real
 * state:
 *
 * - Replace re-ran the search through a `setTimeout` that captured the
 *   pre-replace render's `performFind`, so the "n of m" counter kept counting
 *   the text that had just been replaced.
 * - Closing the bar left the match list in place, and the canvas highlight
 *   overlay (not gated on the bar being open) kept painting the match boxes.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useFindReplace } from './useFindReplace';

function textSlide(id: string, text: string): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements: [
			{
				id: `${id}-t`,
				type: 'text',
				x: 0,
				y: 0,
				width: 100,
				height: 20,
				text,
				textSegments: [{ text, style: {} }],
			},
		],
	} as unknown as PptxSlide;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

type Api = ReturnType<typeof useFindReplace>;

function mount(initial: PptxSlide[]): { api: () => Api; slides: () => PptxSlide[] } {
	let api!: Api;
	let current = initial;
	function Harness() {
		const [slides, setSlides] = useState(initial);
		current = slides;
		api = useFindReplace({
			slides,
			mode: 'edit',
			onSetActiveSlideIndex: () => {},
			onSetSelectedElementId: () => {},
			onUpdateSlides: (updater) => setSlides((prev) => updater(prev)),
			onMarkDirty: () => {},
		});
		return null;
	}
	act(() => {
		root.render(<Harness />);
	});
	return { api: () => api, slides: () => current };
}

describe('useFindReplace', () => {
	it('recounts against the replaced slides after Replace All', () => {
		const { api, slides } = mount([textSlide('a', 'foo foo'), textSlide('b', 'foo')]);
		act(() => {
			api().setFindReplaceOpen(true);
			api().setFindQuery('foo');
			api().setReplaceQuery('bar');
		});
		act(() => {
			api().performFind();
		});
		expect(api().findResults).toHaveLength(3);
		act(() => {
			api().handleReplaceAll();
		});
		expect(slides().map((s) => (s.elements[0] as { text?: string }).text)).toStrictEqual([
			'bar bar',
			'bar',
		]);
		expect(api().findResults).toHaveLength(0);
		expect(api().findResultIndex).toBe(-1);
	});

	it('drops the match list when the bar closes', () => {
		const { api } = mount([textSlide('a', 'foo')]);
		act(() => {
			api().setFindReplaceOpen(true);
			api().setFindQuery('foo');
		});
		act(() => {
			api().performFind();
		});
		expect(api().findResults).toHaveLength(1);
		act(() => {
			api().setFindReplaceOpen(false);
		});
		expect(api().findResults).toHaveLength(0);
		expect(api().findResultIndex).toBe(-1);
	});
});
