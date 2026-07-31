import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import DrawTab from './DrawTab.svelte';

/**
 * DrawTab tests: the five-tool selector (React parity: Freeform beside
 * select/pen/highlighter/eraser) and the colour/width labels the cross-binding
 * ribbon inventory diffs on.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountTab(editable = true): HTMLElement {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(DrawTab, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('drawTab', () => {
	it('offers all five drawing tools', () => {
		const target = mountTab();
		const labels = [...target.querySelectorAll('button[aria-pressed]')].map((button) =>
			button.getAttribute('aria-label'),
		);
		expect(labels).toStrictEqual(['Select', 'Pen', 'Highlighter', 'Eraser', 'Freeform']);
	});

	it('names the colour and width controls the way React does', () => {
		const target = mountTab();
		expect(target.querySelector('button[aria-label="Colour"]')).toBeTruthy();
		const width = [...target.querySelectorAll('label')].find((node) =>
			node.textContent?.includes('Width'),
		);
		// No aria-label on the slider: the wrapping label is what names it, so
		// "Width" is both what the user reads and what the a11y tree reports.
		expect(width?.querySelector('input')?.hasAttribute('aria-label')).toBeFalsy();
	});

	it('activates the freeform tool', () => {
		const target = mountTab();
		const freeform = target.querySelector<HTMLButtonElement>('button[aria-label="Freeform"]');
		freeform?.click();
		flushSync();
		expect(freeform?.getAttribute('aria-pressed')).toBe('true');
	});
});
