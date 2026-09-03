import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import TextFormatGroup from '../../TextFormatGroup.svelte';
import DrawingGroup from './DrawingGroup.svelte';
import ParagraphDropdowns from './ParagraphDropdowns.svelte';
import TextShadowToggle from './TextShadowToggle.svelte';

/**
 * The Home-tab controls added to close the gap with React's ribbon: the
 * Drawing group (Shapes gallery, Arrange menu, Shape Effects placeholder), the
 * Text Direction / Columns dropdowns, and the Text Shadow toggle.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(withText = false, fontSize?: number): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: withText
				? [
						{
							type: 'text',
							id: 'text-1',
							x: 0,
							y: 0,
							width: 100,
							height: 20,
							text: 'Hi',
							textStyle: fontSize === undefined ? {} : { fontSize },
						},
					]
				: [],
		},
	]);
	if (withText) {
		editor.select('text-1');
	}
	return editor;
}

/** All three components under test take the same single `editor` prop. */
type EditorOnly = Component<{ editor: EditorState }>;

function mountComponent(component: EditorOnly, editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function byText(target: HTMLElement, text: string): HTMLButtonElement | undefined {
	return [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent?.trim() === text,
	);
}

describe('home drawing group', () => {
	it('offers Shapes, Arrange and the Shape Effects placeholder', () => {
		const target = mountComponent(DrawingGroup, makeEditor());

		expect(byText(target, 'Shapes')).toBeDefined();
		expect(byText(target, 'Arrange')).toBeDefined();
		const effects = target.querySelector<HTMLButtonElement>(
			'button[title="Shape Effects (not available)"]',
		);
		expect(effects?.disabled).toBeTruthy();
	});

	it('inserts a preset from the Shapes gallery', () => {
		const editor = makeEditor();
		const target = mountComponent(DrawingGroup, editor);

		byText(target, 'Shapes')?.click();
		flushSync();
		target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[0]?.click();
		flushSync();

		expect(editor.slides[0]?.elements[0]?.type).toBe('shape');
		expect(target.querySelector('[role="menu"]')).toBeNull();
	});

	it('needs a selection before Arrange opens', () => {
		expect(byText(mountComponent(DrawingGroup, makeEditor()), 'Arrange')?.disabled).toBeTruthy();
		expect(byText(mountComponent(DrawingGroup, makeEditor(true)), 'Arrange')?.disabled).toBeFalsy();
	});
});

describe('home paragraph dropdowns', () => {
	it('needs a text selection', () => {
		const target = mountComponent(ParagraphDropdowns, makeEditor());
		for (const button of target.querySelectorAll('button')) {
			expect(button.disabled).toBeTruthy();
		}
	});

	it('writes the chosen text direction to the element style', () => {
		const editor = makeEditor(true);
		const target = mountComponent(ParagraphDropdowns, editor);

		target.querySelector<HTMLButtonElement>('button[aria-label="Text Direction"]')?.click();
		flushSync();
		byText(target, 'Rotate 270°')?.click();
		flushSync();

		const el = editor.slides[0]?.elements[0];
		expect(el?.type === 'text' ? el.textStyle?.textDirection : '').toBe('vertical270');
	});

	it('writes the chosen column count to the element style', () => {
		const editor = makeEditor(true);
		const target = mountComponent(ParagraphDropdowns, editor);

		target.querySelector<HTMLButtonElement>('button[title="Columns"]')?.click();
		flushSync();
		byText(target, '3 Columns')?.click();
		flushSync();

		const el = editor.slides[0]?.elements[0];
		expect(el?.type === 'text' ? el.textStyle?.columnCount : 0).toBe(3);
	});
});

describe('home text shadow toggle', () => {
	it('is inert without a text selection', () => {
		const target = mountComponent(TextShadowToggle, makeEditor());
		expect(target.querySelector('button')?.disabled).toBeTruthy();
	});

	it('turns the default shadow on and back off', () => {
		const editor = makeEditor(true);
		const target = mountComponent(TextShadowToggle, editor);
		const button = target.querySelector<HTMLButtonElement>('button');

		button?.click();
		flushSync();
		let el = editor.slides[0]?.elements[0];
		expect(el?.type === 'text' ? el.textStyle?.textShadowColor : '').toBe('#000000');
		expect(button?.getAttribute('aria-pressed')).toBe('true');

		button?.click();
		flushSync();
		el = editor.slides[0]?.elements[0];
		expect(el?.type === 'text' ? el.textStyle?.textShadowColor : 'x').toBeUndefined();
	});
});

describe('home text font size', () => {
	it('shows points and converts fractional point edits back to model pixels', () => {
		const editor = makeEditor(true, 48.1 * (96 / 72));
		const target = mountComponent(TextFormatGroup, editor);
		const input = target.querySelector<HTMLInputElement>('[aria-label="Font size"]');

		expect(input?.value).toBe('48.1');
		expect(input?.step).toBe('any');
		input!.value = '10.1';
		input!.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const element = editor.slides[0]?.elements[0];
		expect(element?.type === 'text' ? element.textStyle?.fontSize : undefined).toBeCloseTo(
			10.1 * (96 / 72),
		);
	});
});
