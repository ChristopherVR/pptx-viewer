import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * The Selection Pane's hide toggle must actually hide the shape.
 *
 * The element is skipped rather than painted invisibly: nothing in the DOM
 * means nothing to hit-test, focus, announce or rasterise into an export. The
 * Selection Pane keeps listing it, because the pane reads the slide model.
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1, interactive: true },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const base = { id: 'sp_1', x: 5, y: 6, width: 120, height: 40, type: 'shape' as const };

describe('hidden elements are not rendered', () => {
	it('renders a visible element', () => {
		const target = mountEl({ ...base } as PptxElement);
		expect(target.querySelectorAll('[data-element-id]')).toHaveLength(1);
	});

	it('renders nothing for a hidden element', () => {
		const target = mountEl({ ...base, hidden: true } as PptxElement);
		expect(target.querySelectorAll('[data-element-id]')).toHaveLength(0);
		expect(target.querySelector('[data-pptx-element]')).toBeNull();
	});

	it('drops a hidden group child but keeps its visible siblings', () => {
		const target = mountEl({
			id: 'grp_1',
			type: 'group',
			x: 0,
			y: 0,
			width: 400,
			height: 200,
			children: [
				{ ...base, id: 'child_visible' },
				{ ...base, id: 'child_hidden', hidden: true },
			],
		} as unknown as PptxElement);
		expect(target.querySelector('[data-element-id="child_visible"]')).not.toBeNull();
		expect(target.querySelector('[data-element-id="child_hidden"]')).toBeNull();
	});
});
