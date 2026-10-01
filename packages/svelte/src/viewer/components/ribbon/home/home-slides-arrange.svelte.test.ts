import { registerPptxWebControls } from 'pptx-viewer-shared';
import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ArrangeHomeStrip from './ArrangeHomeStrip.svelte';
import DrawingGroup from './DrawingGroup.svelte';
import SlidesGroup from './SlidesGroup.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const shape = (id: string) => ({
	type: 'shape' as const,
	id,
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	shapeType: 'rect',
});

function makeEditor(ids: string[] = []): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: ids.map(shape) }]);
	if (ids.length > 0) {
		editor.selection.setAll(ids);
	}
	return editor;
}

function render(component: Component<never>, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component as Component<Record<string, unknown>>, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

const control = (target: HTMLElement, id: string) =>
	target.querySelector<HTMLElement>(`[data-ribbon-control="${id}"]`)!;
const buttonOf = (target: HTMLElement, id: string) => {
	const el = control(target, id);
	return el instanceof HTMLButtonElement ? el : el.querySelector('button')!;
};

describe('shared Slides group', () => {
	it('renders the shared group with every public id once and gates on edit rights', () => {
		const editor = makeEditor();
		const target = render(SlidesGroup, { editor, onnavigate: () => undefined });
		expect(target.querySelectorAll('[data-ribbon-group="home.slides"]')).toHaveLength(1);
		for (const id of ['newSlide', 'slideTemplates', 'layout', 'reset', 'section']) {
			expect(target.querySelectorAll(`[data-ribbon-control="home.slides.${id}"]`)).toHaveLength(1);
		}
		expect(buttonOf(target, 'home.slides.newSlide').disabled).toBeFalsy();
		// Section needs a slide; Reset only needs edit rights.
		expect(buttonOf(target, 'home.slides.section').disabled).toBeFalsy();
	});

	it('locks every slide control in read-only mode', () => {
		const editor = makeEditor();
		editor.editable = false;
		const target = render(SlidesGroup, { editor, onnavigate: () => undefined });
		for (const id of ['newSlide', 'slideTemplates', 'layout', 'reset', 'section']) {
			expect(buttonOf(target, `home.slides.${id}`).disabled).toBeTruthy();
		}
	});

	it('inserts a slide and opens the New Slide caret menu natively', () => {
		const editor = makeEditor();
		const navigated: number[] = [];
		const target = render(SlidesGroup, { editor, onnavigate: (i: number) => navigated.push(i) });
		buttonOf(target, 'home.slides.newSlide').click();
		flushSync();
		expect(editor.slides).toHaveLength(2);
		expect(navigated).toHaveLength(1);
		target.querySelector<HTMLButtonElement>('[data-pptx-chrome="split-caret"]')?.click();
		flushSync();
		expect(target.querySelector('[role="menu"]')).not.toBeNull();
		expect(
			target.querySelector('[data-pptx-chrome="split-caret"]')?.getAttribute('aria-expanded'),
		).toBe('true');
	});
});

describe('shared Drawing triggers', () => {
	it('keeps Shape Fill and Outline gated on a selected shape and opens the native popover', () => {
		const none = render(DrawingGroup, { editor: makeEditor() });
		expect(buttonOf(none, 'home.drawing.shapes').disabled).toBeFalsy();
		expect(buttonOf(none, 'home.drawing.shapeFill').disabled).toBeTruthy();
		cleanup?.();
		const editor = makeEditor(['a']);
		const target = render(DrawingGroup, { editor });
		expect(buttonOf(target, 'home.drawing.shapeFill').disabled).toBeFalsy();
		buttonOf(target, 'home.drawing.shapeFill').click();
		flushSync();
		expect(target.querySelector('[role="menu"]')).not.toBeNull();
		target.querySelector<HTMLButtonElement>('.pptx-svelte-swatch-cell')?.click();
		flushSync();
		expect(target.querySelector('[role="menu"]')).toBeNull();
	});
});

describe('shared Arrange strips', () => {
	it('gates align, distribute, flip, order and edit on the multi-selection', () => {
		const one = makeEditor(['a']);
		const align = render(ArrangeHomeStrip, { editor: one, strip: 'align' });
		const buttons = [...align.querySelectorAll<HTMLButtonElement>('button')];
		expect(buttons).toHaveLength(8);
		expect(buttons.slice(0, 6).every((button) => !button.disabled)).toBeTruthy();
		expect(buttons.slice(6).every((button) => button.disabled)).toBeTruthy();
		expect(align.querySelectorAll('[data-ribbon-control="home.arrange.align"]')).toHaveLength(1);
		cleanup?.();
		const three = render(ArrangeHomeStrip, { editor: makeEditor(['a', 'b', 'c']), strip: 'align' });
		expect(
			[...three.querySelectorAll<HTMLButtonElement>('button')].every((button) => !button.disabled),
		).toBeTruthy();
	});

	it('routes order and edit intents through the editor with undo support', () => {
		const editor = makeEditor(['a', 'b']);
		editor.selection.set('a');
		const order = render(ArrangeHomeStrip, { editor, strip: 'order' });
		buttonOf(order, 'home.arrange.bringToFront').click();
		flushSync();
		expect(editor.slides[0]?.elements.map((el) => el.id)).toStrictEqual(['b', 'a']);
		cleanup?.();
		const edit = render(ArrangeHomeStrip, { editor, strip: 'edit' });
		buttonOf(edit, 'home.arrange.delete').click();
		flushSync();
		expect(editor.slides[0]?.elements.map((el) => el.id)).toStrictEqual(['b']);
	});

	it('disables every strip in read-only mode and without a selection', () => {
		const editor = makeEditor(['a']);
		editor.editable = false;
		for (const strip of ['align', 'flip', 'order', 'edit'] as const) {
			const target = render(ArrangeHomeStrip, { editor, strip });
			expect(
				[...target.querySelectorAll<HTMLButtonElement>('button')].every((b) => b.disabled),
			).toBeTruthy();
			cleanup?.();
		}
		const empty = render(ArrangeHomeStrip, { editor: makeEditor(), strip: 'flip' });
		expect(buttonOf(empty, 'home.arrange.flipHorizontal').disabled).toBeTruthy();
	});
});
