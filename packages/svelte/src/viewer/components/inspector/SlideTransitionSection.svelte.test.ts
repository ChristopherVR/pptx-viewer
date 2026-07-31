import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import SlideTransitionSection from './SlideTransitionSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountSection(): { target: HTMLElement; editor: EditorState } {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	editor.editable = true;
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideTransitionSection, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, editor };
}

function typeSelect(target: HTMLElement): HTMLSelectElement {
	return target.querySelector<HTMLSelectElement>('select')!;
}

function setValue(control: HTMLSelectElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('slideTransitionSection', () => {
	it('writes the chosen transition type onto the active slide', () => {
		const { target, editor } = mountSection();

		setValue(typeSelect(target), 'fade');

		expect(editor.slides[0]?.transition?.type).toBe('fade');
		expect(editor.dirty).toBeTruthy();
	});

	it('offers a direction picker for a directional transition only', () => {
		const { target } = mountSection();
		expect(target.querySelector('.pptx-svelte-dir-grid, .pptx-svelte-dir-row')).toBeNull();

		setValue(typeSelect(target), 'push');

		expect(target.querySelector('.pptx-svelte-dir-grid, .pptx-svelte-dir-row')).not.toBeNull();
	});

	it('swaps the direction picker for an orientation toggle on the blinds family', () => {
		const { target, editor } = mountSection();

		setValue(typeSelect(target), 'blinds');

		expect(target.querySelector('.pptx-svelte-dir-grid, .pptx-svelte-dir-row')).toBeNull();
		const orient = Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-transition-orient button'),
		);
		expect(orient).toHaveLength(2);
		orient[1].click();
		flushSync();
		expect(editor.slides[0]?.transition?.orient).toBe('vert');
	});

	it('shows a spokes input for wheel and clamps it', () => {
		const { target, editor } = mountSection();

		setValue(typeSelect(target), 'wheel');
		const numbers = Array.from(target.querySelectorAll<HTMLInputElement>('input[type="number"]'));
		expect(numbers.length).toBeGreaterThan(1);
		setValue(numbers[0], '99');

		expect(editor.slides[0]?.transition?.spokes).toBe(8);
	});

	it('clamps the duration and preserves the transition type', () => {
		const { target, editor } = mountSection();

		setValue(typeSelect(target), 'fade');
		const duration = target.querySelector<HTMLInputElement>('input[type="number"]')!;
		setValue(duration, '50000');

		expect(editor.slides[0]?.transition?.durationMs).toBe(10000);
		expect(editor.slides[0]?.transition?.type).toBe('fade');
	});

	it('toggles advance-on-click', () => {
		const { target, editor } = mountSection();

		setValue(typeSelect(target), 'fade');
		const check = target.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		expect(check.checked).toBeTruthy();
		check.click();
		flushSync();

		expect(editor.slides[0]?.transition?.advanceOnClick).toBeFalsy();
	});

	it('hides the preview for the no-op transition types', () => {
		const { target } = mountSection();

		setValue(typeSelect(target), 'cut');
		expect(target.querySelector('.pptx-svelte-transition-preview')).toBeNull();

		setValue(typeSelect(target), 'fade');
		expect(target.querySelector('.pptx-svelte-transition-preview')).not.toBeNull();
	});
});
