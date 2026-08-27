import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import AnimationPanel from './AnimationPanel.svelte';

/**
 * EffectSoundRow tests, exercised THROUGH the docked AnimationPanel: the row
 * only matters wired to the panel's commit path, matching how
 * `MotionPathRow.svelte.test.ts` tests its row.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {},
	} as PptxElement;
}

function mountPanel(animations?: PptxElementAnimation[]): {
	editor: EditorState;
	select: HTMLSelectElement;
	fileInput: HTMLInputElement;
	target: HTMLElement;
} {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [shapeEl('shape-1')],
			animations: animations ?? [{ elementId: 'shape-1', entrance: 'fadeIn' }],
		} as PptxSlide,
	]);
	editor.select('shape-1');

	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AnimationPanel, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const select = target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-sound');
	const fileInput = target.querySelector<HTMLInputElement>('input[type="file"]');
	expect(select, 'the animation panel must render the effect sound row').not.toBeNull();
	expect(fileInput, 'the animation panel must render the hidden file input').not.toBeNull();
	return { editor, select: select!, fileInput: fileInput!, target };
}

function choose(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('effectSoundRow', () => {
	it('labels the row and defaults to "No Sound"', () => {
		const { select, target } = mountPanel();
		expect(target.textContent).toContain('Sound');
		expect(select.value).toBe('none');
	});

	it('shows the picked file name once a sound is set', () => {
		const { select } = mountPanel([
			{
				elementId: 'shape-1',
				entrance: 'fadeIn',
				soundRId: 'rId1',
				soundPath: 'ppt/media/audio1.wav',
			},
		]);
		expect(select.value).toBe('custom');
		expect(select.querySelector('option[value="custom"]')?.textContent).toBe('audio1.wav');
	});

	it('clears the sound when "No Sound" is chosen', () => {
		const { editor, select } = mountPanel([
			{
				elementId: 'shape-1',
				entrance: 'fadeIn',
				soundRId: 'rId1',
				soundPath: 'ppt/media/audio1.wav',
			},
		]);
		choose(select, 'none');
		const anim = editor.slides[0]?.animations?.[0];
		expect(anim?.soundRId).toBeUndefined();
		expect(anim?.soundData).toBeUndefined();
	});

	it('stages a picked file as a data: URL', async () => {
		const { editor, fileInput } = mountPanel();
		const file = new File(['abc'], 'chime.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(fileInput, 'files', { value: [file] });
		fileInput.dispatchEvent(new Event('change', { bubbles: true }));

		for (
			let attempt = 0;
			attempt < 50 && !editor.slides[0]?.animations?.[0]?.soundData;
			attempt++
		) {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}

		const anim = editor.slides[0]?.animations?.[0];
		expect(anim?.soundFileName).toBe('chime.mp3');
		expect(anim?.soundData).toMatch(/^data:/u);
	});

	it('is read-only when the deck is not editable', () => {
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = false;
		editor.setSlides([
			{
				id: 's1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [shapeEl('shape-1')],
				animations: [{ elementId: 'shape-1', entrance: 'fadeIn' }],
			} as PptxSlide,
		]);
		editor.select('shape-1');
		const target = document.createElement('div');
		const instance = mount(AnimationPanel, { target, props: { editor } });
		flushSync();
		cleanup = () => unmount(instance);

		const select = target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-sound');
		expect(select?.disabled).toBeTruthy();
	});
});
