import type { PptxElement } from 'pptx-viewer-core';
import type { PptxUiSelectElement } from 'pptx-viewer-shared';
import { createRibbonControlIcon } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../../../editor/editor-state.svelte';
import FontFamilySelect from './FontFamilySelect.svelte';
import FontFormattingGroup from './FontFormattingGroup.svelte';
import FontSizeSelect from './FontSizeSelect.svelte';

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

describe('shared font fields in Svelte', () => {
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

	it('keeps a decimal display and converts one preset edit from points to pixels', async () => {
		const patchSelected = vi.fn();
		const target = document.createElement('div');
		document.body.append(target);
		const instance = mount(FontSizeSelect, {
			target,
			props: {
				editor: { editable: true, selectedElement: text, patchSelected } as unknown as EditorState,
			},
		});
		flushSync();
		const select = target.querySelector<PptxUiSelectElement>('pptx-ui-select')!;
		expect(select.shadowRoot!.querySelector('[part="value"]')?.textContent).toBe('40.5');
		select.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
		const index = select.options.findIndex((option) => option.value === '24');
		select.shadowRoot!.querySelector<HTMLElement>(`[data-index="${index}"]`)!.click();
		expect(patchSelected).toHaveBeenCalledOnce();
		expect(patchSelected.mock.calls[0][0](text).textStyle.fontSize).toBe(32);
		patchSelected.mockClear();
		const custom = select.querySelector('input')!;
		custom.value = '48.1';
		custom.dispatchEvent(new Event('change', { bubbles: true }));
		expect(patchSelected).toHaveBeenCalledOnce();
		expect(patchSelected.mock.calls[0][0](text).textStyle.fontSize).toBeCloseTo((48.1 * 96) / 72);
		await unmount(instance);
		target.remove();
	});

	it('forwards a font-family menu choice once with theme metadata preserved', async () => {
		const patchSelected = vi.fn();
		const target = document.createElement('div');
		document.body.append(target);
		const editor = {
			editable: true,
			selectedElement: text,
			patchSelected,
			theme: { fontScheme: { minorFont: { latin: 'Calibri' } } },
		} as unknown as EditorState;
		const instance = mount(FontFamilySelect, { target, props: { editor } });
		flushSync();
		const select = target.querySelector<PptxUiSelectElement>('pptx-ui-select')!;
		select.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
		const index = select.options.findIndex((option) => option.value === 'Arial');
		select.shadowRoot!.querySelector<HTMLElement>(`[data-index="${index}"]`)!.click();
		expect(patchSelected).toHaveBeenCalledOnce();
		expect(patchSelected.mock.calls[0][0](text).textStyle.fontFamily).toBe('Arial');
		await unmount(instance);
		target.remove();
	});
});
