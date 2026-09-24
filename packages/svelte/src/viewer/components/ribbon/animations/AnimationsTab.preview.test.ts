/**
 * AnimationsTab's Preview button: it must play the selected element's own
 * authored effect on the canvas, and (matching react/vue/angular/vanilla) be
 * enabled whenever something editable is selected, not only when that
 * selection already carries an animation entry (the button click itself is a
 * safe no-op otherwise).
 */
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import AnimationsTab from './AnimationsTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
	for (const style of [...document.querySelectorAll('style[id^="pptx-anim-ribbon-preview-"]')]) {
		style.remove();
	}
});

function makeEditor(withAnimation: boolean): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [
				{ type: 'text', id: 'text-1', x: 0, y: 0, width: 10, height: 10, text: 'a', textStyle: {} },
			],
			animations: withAnimation
				? [{ elementId: 'text-1', entrance: 'fadeIn', durationMs: 400, order: 0 }]
				: [],
		},
	]);
	editor.select('text-1');
	return editor;
}

function mountTab(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AnimationsTab, { target, props: { editor } });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

function previewButton(target: HTMLElement): HTMLButtonElement | undefined {
	return [...target.querySelectorAll('button')].find(
		(button) => button.textContent?.trim() === 'Preview',
	);
}

describe('animationsTab Preview button', () => {
	it('is enabled for a selection with no animation entry yet (parity with the other four bindings)', () => {
		const target = mountTab(makeEditor(false));
		expect(previewButton(target)?.disabled).toBeFalsy();
	});

	it('is disabled without a selection', () => {
		const editor = makeEditor(false);
		editor.select(null);
		const target = mountTab(editor);
		flushSync();
		expect(previewButton(target)?.disabled).toBeTruthy();
	});

	it('plays the selected element own effect on click', () => {
		const target = mountTab(makeEditor(true));
		document.body.querySelector('[data-element-id]')?.remove();
		const canvasEl = document.createElement('div');
		canvasEl.setAttribute('data-element-id', 'text-1');
		document.body.appendChild(canvasEl);

		previewButton(target)?.click();
		flushSync();

		expect(canvasEl.style.animation).toContain('400ms');
	});

	it('does nothing when the element has no animation entry', () => {
		const target = mountTab(makeEditor(false));
		const canvasEl = document.createElement('div');
		canvasEl.setAttribute('data-element-id', 'text-1');
		document.body.appendChild(canvasEl);

		previewButton(target)?.click();
		flushSync();

		expect(canvasEl.style.animation).toBe('');
	});
});
