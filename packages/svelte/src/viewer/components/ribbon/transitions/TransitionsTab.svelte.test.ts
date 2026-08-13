import { TRANSITION_PREVIEW_ATTR } from 'pptx-viewer-shared';
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

function makeEditor(slideCount = 1): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides(
		Array.from({ length: slideCount }, (_, index) => ({
			id: `s${index + 1}`,
			rId: `rId${index + 1}`,
			slideNumber: index + 1,
			elements: [],
		})),
	);
	return editor;
}

/** jsdom/happy-dom activation does not reach Svelte's delegated listeners. */
function fire(input: HTMLInputElement, type: 'input' | 'change'): void {
	input.dispatchEvent(new Event(type, { bubbles: true }));
	flushSync();
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

function button(target: HTMLElement, caption: string): HTMLButtonElement | undefined {
	return [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.textContent?.trim() === caption,
	);
}

describe('transitionsTab', () => {
	it('offers the timing and advance controls React does', () => {
		const target = mountTab(makeEditor());

		expect(label(target, 'Duration')?.querySelector('input')).toBeTruthy();
		expect(label(target, 'Sound')?.querySelector('select')).toBeTruthy();
		// A BUTTON, like PowerPoint's and like the other four bindings': this used
		// to be an arming checkbox with no counterpart in the product.
		expect(button(target, 'Apply to All')).toBeTruthy();
		expect(label(target, 'Apply to All')).toBeUndefined();
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

	it('replays the slide transition on the stage from Preview', () => {
		const editor = makeEditor();
		const target = mountTab(editor);
		const stage = document.createElement('div');
		stage.setAttribute('aria-roledescription', 'slide');
		document.body.appendChild(stage);

		button(target, 'Fade')?.click();
		flushSync();
		expect(editor.slides[0]?.transition?.type).toBe('fade');

		button(target, 'Preview')?.click();
		flushSync();
		// The stage is marked for the length of the replay, and the deck is left
		// exactly as it was: a preview is not an edit.
		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('fade');
		expect(editor.slides[0]?.transition?.type).toBe('fade');
		stage.remove();
	});

	it('writes the picked preset and the tab duration onto the slide', () => {
		const editor = makeEditor();
		const target = mountTab(editor);

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((candidate) => candidate.textContent?.trim() === 'Push')
			?.click();
		flushSync();
		expect(editor.slides[0]?.transition?.type).toBe('push');
		expect(editor.slides[0]?.transition?.durationMs).toBe(700);

		// The duration is its own commit, not a modifier staged for the next
		// preset click.
		const duration = label(target, 'Duration')?.querySelector('input');
		duration!.value = '1.5';
		fire(duration!, 'input');
		expect(editor.slides[0]?.transition).toMatchObject({ type: 'push', durationMs: 1500 });
	});

	it('commits the Advance Slide boxes as they are ticked', () => {
		const editor = makeEditor();
		const target = mountTab(editor);

		const onClick = label(target, 'On Mouse Click')?.querySelector('input');
		onClick!.checked = false;
		fire(onClick!, 'change');
		expect(editor.slides[0]?.transition).toMatchObject({ advanceOnClick: false });

		const after = label(target, 'After');
		const [checkbox, seconds] = [...after!.querySelectorAll<HTMLInputElement>('input')];
		checkbox.checked = true;
		fire(checkbox, 'change');
		seconds.value = '00:03.00';
		fire(seconds, 'change');
		expect(editor.slides[0]?.transition?.advanceAfterMs).toBe(3000);

		// Unticking clears the timed advance rather than leaving it armed.
		checkbox.checked = false;
		fire(checkbox, 'change');
		expect(editor.slides[0]?.transition?.advanceAfterMs).toBeUndefined();
	});

	it('applies the tab to every slide when Apply to All is pressed', () => {
		const editor = makeEditor(3);
		const target = mountTab(editor);

		button(target, 'Wipe')?.click();
		flushSync();
		// Picking a preset touches the ACTIVE slide only.
		expect(editor.slides[1]?.transition).toBeUndefined();

		button(target, 'Apply to All')?.click();
		flushSync();

		for (const slide of editor.slides) {
			expect(slide.transition).toMatchObject({ type: 'wipe', durationMs: 700 });
		}
	});

	it('disables the Sound select, which no binding can author', () => {
		const target = mountTab(makeEditor());
		expect(label(target, 'Sound')?.querySelector('select')?.disabled).toBeTruthy();
	});

	it('seeds the controls from the active slide rather than a fixed default', () => {
		const editor = new EditorState({ getCurrent: () => 1, getHandler: () => null });
		editor.editable = true;
		editor.setSlides([
			{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
			{
				id: 's2',
				rId: 'rId2',
				slideNumber: 2,
				elements: [],
				transition: { type: 'cover', durationMs: 2000, advanceAfterMs: 5000 },
			},
		]);
		const target = mountTab(editor);

		expect(label(target, 'Duration')?.querySelector('input')?.value).toBe('2');
		const [checkbox, seconds] = [
			...(label(target, 'After')?.querySelectorAll<HTMLInputElement>('input') ?? []),
		];
		expect(checkbox.checked).toBeTruthy();
		expect(seconds.value).toBe('00:05.00');
	});

	it('opens the inspector from the Inspector button', () => {
		const chromeUi = new ChromeUiState();
		chromeUi.inspectorOpen = false;
		const target = mountTab(makeEditor(), chromeUi);

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((candidate) => candidate.textContent?.trim() === 'Inspector')
			?.click();
		flushSync();

		expect(chromeUi.inspectorOpen).toBeTruthy();
	});
});
