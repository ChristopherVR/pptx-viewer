import type { PptxElement } from 'pptx-viewer-core';
import { createRibbonControlIcon, registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../../../editor/editor-state.svelte';
import FontFormattingGroup from './FontFormattingGroup.svelte';
import FontPickerGroup from './FontPickerGroup.svelte';

registerPptxWebControls();

const text = {
	id: 'text',
	type: 'text',
	text: 'Hello',
	x: 0,
	y: 0,
	width: 100,
	height: 40,
	textStyle: { fontFamily: 'Calibri', fontSize: 54 },
} as PptxElement;

type Field = HTMLElement & { value: string };

function picker(target: HTMLElement, kind: 'family' | 'size'): Field {
	return target.querySelector<Field>(`pptx-ui-select[data-font-picker="${kind}"]`)!;
}

function choose(select: Field, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('shared font controls in Svelte', () => {
	it('joins disabled formatting actions over their shared canonical artwork', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const instance = mount(FontFormattingGroup, {
			target,
			props: { editor: { editable: false, selectedElement: text } as unknown as EditorState },
		});
		flushSync();
		for (const control of ['bold', 'italic', 'increaseFontSize', 'decreaseFontSize']) {
			const button = target.querySelector<HTMLButtonElement>(
				`[data-ribbon-control="home.font.${control}"]`,
			)!;
			expect(button.disabled).toBeTruthy();
			expect(button.querySelector('svg')?.innerHTML.replace(/<!---->/g, '')).toBe(
				createRibbonControlIcon(document, `home.font.${control}`).innerHTML,
			);
			expect(button.parentElement?.dataset.pptxChrome).toBe('control-cluster');
		}
		await unmount(instance);
		target.remove();
	});

	it('renders the pickers on the shared select and hooks, inside the Font group the tab draws', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const editor = { editable: true, selectedElement: text } as unknown as EditorState;
		const instance = mount(FontPickerGroup, { target, props: { editor } });
		flushSync();
		// The fields are the first row of the Font group the tab draws, not a group of their own.
		expect(target.querySelectorAll('[data-ribbon-group]')).toHaveLength(0);
		expect(picker(target, 'family').dataset.ribbonControl).toBe('home.font.fontFamily');
		expect(picker(target, 'size').dataset.ribbonControl).toBe('home.font.fontSize');
		expect(picker(target, 'family').getAttribute('variant')).toBe('ribbon-font');
		// 54px is 40.5pt: a decimal outside the presets stays displayed.
		expect(picker(target, 'size').value).toBe('40.5');
		await unmount(instance);
		target.remove();
	});

	it('converts one preset size edit from points to pixels', async () => {
		const patchSelected = vi.fn();
		const target = document.createElement('div');
		document.body.append(target);
		const instance = mount(FontPickerGroup, {
			target,
			props: {
				editor: { editable: true, selectedElement: text, patchSelected } as unknown as EditorState,
			},
		});
		flushSync();
		choose(picker(target, 'size'), '24');
		expect(patchSelected).toHaveBeenCalledOnce();
		expect(patchSelected.mock.calls[0][0](text).textStyle.fontSize).toBe(32);
		await unmount(instance);
		target.remove();
	});

	it('forwards a font-family choice once with theme metadata preserved', async () => {
		const patchSelected = vi.fn();
		const target = document.createElement('div');
		document.body.append(target);
		const editor = {
			editable: true,
			selectedElement: text,
			patchSelected,
			theme: { fontScheme: { minorFont: { latin: 'Calibri' } } },
		} as unknown as EditorState;
		const instance = mount(FontPickerGroup, { target, props: { editor } });
		flushSync();
		const groups = picker(target, 'family').querySelectorAll('optgroup');
		expect(groups[0].label).toBe('Theme fonts');
		choose(picker(target, 'family'), 'Arial');
		expect(patchSelected).toHaveBeenCalledOnce();
		expect(patchSelected.mock.calls[0][0](text).textStyle.fontFamily).toBe('Arial');
		await unmount(instance);
		target.remove();
	});

	it('disables both pickers without a text selection', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const editor = { editable: true, selectedElement: undefined } as unknown as EditorState;
		const instance = mount(FontPickerGroup, { target, props: { editor } });
		flushSync();
		expect(picker(target, 'family').hasAttribute('disabled')).toBeTruthy();
		expect(picker(target, 'size').hasAttribute('disabled')).toBeTruthy();
		await unmount(instance);
		target.remove();
	});
});
