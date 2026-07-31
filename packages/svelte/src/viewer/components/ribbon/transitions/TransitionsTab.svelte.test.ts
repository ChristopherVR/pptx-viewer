import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import { ChromeUiState } from '../../../state/chrome-ui.svelte';
import TransitionsTab from './TransitionsTab.svelte';

/**
 * TransitionsTab tests: the Timing / Advance Slide / Inspector controls added
 * alongside the preset gallery, and that Preview replays the slide's own
 * transition rather than being decoration.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

function mountTab(editor: EditorState, chromeUi?: ChromeUiState): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(TransitionsTab, { target, props: { editor, chromeUi } });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

function label(target: HTMLElement, caption: string): HTMLLabelElement | undefined {
	return [...target.querySelectorAll('label')].find((node) =>
		node.textContent?.trim().startsWith(caption),
	);
}

describe('transitionsTab', () => {
	it('offers the timing and advance controls React does', () => {
		const target = mountTab(makeEditor());

		expect(label(target, 'Duration')?.querySelector('input')).toBeTruthy();
		expect(label(target, 'Sound')?.querySelector('select')).toBeTruthy();
		expect(label(target, 'Apply to All')?.querySelector('input')).toBeTruthy();
		expect(label(target, 'On Mouse Click')?.querySelector('input')).toBeTruthy();
		// "After" wraps both a checkbox and the seconds box, as React's does.
		expect(label(target, 'After')?.querySelectorAll('input')).toHaveLength(2);
	});

	it('leaves the After seconds box inert until After is ticked', () => {
		const target = mountTab(makeEditor());
		const after = label(target, 'After');
		const [checkbox, seconds] = [...(after?.querySelectorAll('input') ?? [])];

		expect((seconds as HTMLInputElement).disabled).toBeTruthy();
		// Dispatched rather than `.click()`: jsdom's checkbox activation does not
		// reach Svelte's delegated `change` listener.
		(checkbox as HTMLInputElement).checked = true;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect((seconds as HTMLInputElement).disabled).toBeFalsy();
	});

	it('replays the slide transition from Preview', () => {
		const editor = makeEditor();
		const target = mountTab(editor);

		const buttons = [...target.querySelectorAll<HTMLButtonElement>('button')];
		buttons.find((button) => button.textContent?.trim() === 'Fade')?.click();
		flushSync();
		expect(editor.slides[0]?.transition?.type).toBe('fade');

		// Preview re-applies rather than clearing: the slide keeps its transition.
		buttons.find((button) => button.textContent?.trim() === 'Preview')?.click();
		flushSync();
		expect(editor.slides[0]?.transition?.type).toBe('fade');
	});

	it('opens the inspector from the Inspector button', () => {
		const chromeUi = new ChromeUiState();
		chromeUi.inspectorOpen = false;
		const target = mountTab(makeEditor(), chromeUi);

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent?.trim() === 'Inspector')
			?.click();
		flushSync();

		expect(chromeUi.inspectorOpen).toBeTruthy();
	});
});
