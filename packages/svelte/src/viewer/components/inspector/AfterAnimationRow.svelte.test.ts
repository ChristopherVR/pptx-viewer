import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import AnimationPanel from './AnimationPanel.svelte';

/**
 * AfterAnimationRow tests, exercised THROUGH the docked AnimationPanel, same
 * as `MotionPathRow.svelte.test.ts` / `EffectSoundRow.svelte.test.ts`.
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
	const select = target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-after-animation');
	expect(select, 'the animation panel must render the after-animation row').not.toBeNull();
	return { editor, select: select!, target };
}

function choose(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('afterAnimationRow', () => {
	it('offers all four actions', () => {
		const { select } = mountPanel();
		expect([...select.querySelectorAll('option')].map((option) => option.value)).toStrictEqual([
			...AFTER_ANIMATION_VALUES,
		]);
	});

	it('defaults to none, with no colour swatch', () => {
		const { select, target } = mountPanel();
		expect(select.value).toBe('none');
		expect(target.querySelector('input[type="color"]')).toBeNull();
	});

	it('shows the colour swatch once dimToColor is applied', () => {
		const { editor, select, target } = mountPanel();
		choose(select, 'dimToColor');
		expect(editor.slides[0]?.animations?.[0]?.afterAnimation).toBe('dimToColor');
		expect(target.querySelector<HTMLInputElement>('input[type="color"]')).not.toBeNull();
	});

	it('clears the dim colour when switching away from dimToColor', () => {
		const { editor, select } = mountPanel([
			{
				elementId: 'shape-1',
				entrance: 'fadeIn',
				afterAnimation: 'dimToColor',
				afterAnimationColor: '#123456',
			},
		]);
		choose(select, 'hideAfterAnimation');
		const anim = editor.slides[0]?.animations?.[0];
		expect(anim?.afterAnimation).toBe('hideAfterAnimation');
		expect(anim?.afterAnimationColor).toBeUndefined();
	});

	it('updates the dim colour from the swatch', () => {
		const { editor, target } = mountPanel([
			{
				elementId: 'shape-1',
				entrance: 'fadeIn',
				afterAnimation: 'dimToColor',
				afterAnimationColor: '#123456',
			},
		]);
		const colorInput = target.querySelector<HTMLInputElement>('input[type="color"]')!;
		colorInput.value = '#abcdef';
		colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(editor.slides[0]?.animations?.[0]?.afterAnimationColor?.toLowerCase()).toBe('#abcdef');
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

		const select = target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-after-animation');
		expect(select?.disabled).toBeTruthy();
	});
});
