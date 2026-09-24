// @vitest-environment happy-dom
/**
 * Ctrl/Shift multi-select for the slides pane rail.
 *
 * Only React's full-screen slide-sorter overlay had this; the always-visible
 * rail (this hook) was single-select in all five bindings. The click
 * resolution itself is shared (`resolveSlidePaneClick`); this pins the hook's
 * thin wiring of it.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSlidePaneCallbacks } from './useSlidePaneCallbacks';
import type { SlidePaneCallbacks } from './useSlidePaneCallbacks';

let container: HTMLDivElement;
let root: Root;
let latest: SlidePaneCallbacks;

function Harness(): React.ReactElement {
	latest = useSlidePaneCallbacks(vi.fn());
	return React.createElement('div');
}

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root.render(React.createElement(Harness));
	});
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

const IDS = ['s1', 's2', 's3', 's4'];

function click(
	id: string,
	mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
) {
	act(() => {
		latest.handleSlideClick({ ctrlKey: false, metaKey: false, shiftKey: false, ...mods }, id, IDS);
	});
}

describe('useSlidePaneCallbacks multi-select', () => {
	it('starts with no selection', () => {
		expect(latest.selectedSlideIds).toStrictEqual([]);
	});

	it('a plain click selects just that slide', () => {
		click('s2');
		expect(latest.selectedSlideIds).toStrictEqual(['s2']);
	});

	it('ctrl-click adds to the selection', () => {
		click('s1');
		click('s3', { ctrlKey: true });
		expect(latest.selectedSlideIds).toStrictEqual(['s1', 's3']);
	});

	it('shift-click selects the contiguous range from the last click', () => {
		click('s1');
		click('s4', { shiftKey: true });
		expect(latest.selectedSlideIds).toStrictEqual(['s1', 's2', 's3', 's4']);
	});

	it('a later plain click collapses back to a singleton', () => {
		click('s1');
		click('s4', { shiftKey: true });
		click('s2');
		expect(latest.selectedSlideIds).toStrictEqual(['s2']);
	});
});
