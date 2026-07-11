import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ImageSection from './ImageSection.svelte';

/**
 * ImageSection tests: brightness/contrast/saturation sliders and the
 * four-edge numeric crop, built on the shared `image-adjustments.ts`. Named
 * `*.svelte.test.ts` per the mounted-props convention (see
 * `notes-panel.svelte.test.ts`).
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function imageEl(over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imagePath: 'ppt/media/image1.png',
		...over,
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	return editor;
}

function currentEl(editor: EditorState): PptxElement {
	const el = editor.slides[0]?.elements[0];
	if (!el) {
		throw new Error('element missing');
	}
	return el;
}

type ImageShape = {
	imageEffects?: { brightness?: number; contrast?: number; saturation?: number };
	cropLeft?: number;
	cropTop?: number;
	cropRight?: number;
	cropBottom?: number;
};

function mountSection(
	editor: EditorState,
	el: PptxElement,
): { target: HTMLElement; setProps: (next: { el: PptxElement }) => void } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, el });
	const instance = mount(ImageSection, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return {
		target,
		setProps: (next) => {
			Object.assign(props, next);
			flushSync();
		},
	};
}

describe('imageSection', () => {
	it('sets brightness, contrast, and saturation via the sliders', () => {
		const editor = makeEditor(imageEl());
		const { target, setProps } = mountSection(editor, currentEl(editor));
		const [brightness, contrast, saturation] = Array.from(
			target.querySelectorAll<HTMLInputElement>('input[type="range"]'),
		);
		if (!brightness || !contrast || !saturation) {
			throw new Error('adjustment sliders not found');
		}
		// Each interaction re-syncs the `el` prop with the just-committed slides
		// (as the live `editor.selectedElement` derivation would in the real
		// InspectorPanel tree), so `imageAdjustmentsPatch`'s internal
		// `{...el.imageEffects, ...changes}` merge sees the previous edit.
		brightness.value = '20';
		brightness.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		setProps({ el: currentEl(editor) });

		contrast.value = '-10';
		contrast.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		setProps({ el: currentEl(editor) });

		saturation.value = '5';
		saturation.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		expect((currentEl(editor) as ImageShape).imageEffects).toStrictEqual({
			brightness: 20,
			contrast: -10,
			saturation: 5,
		});
	});

	it('sets the four crop insets, clamped to 0-90%', () => {
		const editor = makeEditor(imageEl());
		const { target } = mountSection(editor, currentEl(editor));
		const [left, top, right, bottom] = Array.from(
			target.querySelectorAll<HTMLInputElement>('input[type="number"]'),
		);
		if (!left || !top || !right || !bottom) {
			throw new Error('crop inputs not found');
		}
		left.value = '10';
		left.dispatchEvent(new Event('change', { bubbles: true }));
		right.value = '200';
		right.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const el = currentEl(editor) as ImageShape;
		expect(el.cropLeft).toBeCloseTo(0.1);
		expect(el.cropRight).toBeCloseTo(0.9);
	});
});
