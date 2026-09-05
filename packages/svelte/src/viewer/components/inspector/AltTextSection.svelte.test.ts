import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import AltTextSection from './AltTextSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountSection(el: PptxElement): { target: HTMLElement; editor: EditorState } {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.editable = true;
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AltTextSection, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, editor };
}

function setValue(control: HTMLTextAreaElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

describe('altTextSection', () => {
	it('shows the alt text and title fields for a shape', () => {
		const shape = {
			type: 'shape',
			id: 'shp1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			shapeType: 'rect',
			altText: 'A red rectangle',
			title: 'Callout',
		} as PptxElement;
		const { target } = mountSection(shape);
		const textarea = target.querySelector('textarea') as HTMLTextAreaElement;
		const input = target.querySelector('input[type="text"]') as HTMLInputElement;
		expect(textarea.value).toBe('A red rectangle');
		expect(input.value).toBe('Callout');
	});

	it('edits altText and title via applyElementPatch', () => {
		const shape = {
			type: 'shape',
			id: 'shp1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			shapeType: 'rect',
		} as PptxElement;
		const { target, editor } = mountSection(shape);
		const textarea = target.querySelector('textarea') as HTMLTextAreaElement;
		setValue(textarea, 'Updated description');
		const updatedShape = editor.slides[0].elements.find((e) => e.id === 'shp1');
		expect((updatedShape as { altText?: string }).altText).toBe('Updated description');

		const input = target.querySelector('input[type="text"]') as HTMLInputElement;
		setValue(input, 'Updated title');
		const reUpdated = editor.slides[0].elements.find((e) => e.id === 'shp1');
		expect((reUpdated as { title?: string }).title).toBe('Updated title');
	});

	it('shows only the alt text field (no title) for a picture', () => {
		const picture = {
			type: 'picture',
			id: 'pic1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			altText: 'A sunset photo',
		} as PptxElement;
		const { target } = mountSection(picture);
		expect(target.querySelector('textarea')).not.toBeNull();
		expect(target.querySelector('input[type="text"]')).toBeNull();
	});

	it('renders nothing for a kind with neither field, like a group', () => {
		const group = { type: 'group', id: 'g1', x: 0, y: 0, width: 10, height: 10, children: [] };
		const { target } = mountSection(group as unknown as PptxElement);
		expect(target.querySelector('textarea')).toBeNull();
		expect(target.querySelector('input[type="text"]')).toBeNull();
	});
});
