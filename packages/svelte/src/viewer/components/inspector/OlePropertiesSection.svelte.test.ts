import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../../editor/editor-state.svelte';
import OlePropertiesSection from './OlePropertiesSection.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function ole(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'ole',
		id: 'o1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		oleObjectType: 'Excel.Sheet.12',
		isLinked: false,
		...overrides,
	} as PptxElement;
}

function createEditor(
	editable = true,
): EditorState & { applyElementPatch: ReturnType<typeof vi.fn> } {
	return {
		editable,
		applyElementPatch: vi.fn(),
	} as unknown as EditorState & { applyElementPatch: ReturnType<typeof vi.fn> };
}

function mountSection(el: PptxElement, editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(OlePropertiesSection, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('olePropertiesSection', () => {
	it('shows Embedded status by default', () => {
		const target = mountSection(ole(), createEditor());
		expect(target.textContent).toContain('Embedded');
	});

	it('shows Linked status for a linked object', () => {
		const target = mountSection(ole({ isLinked: true }), createEditor());
		expect(target.textContent).toContain('Linked');
	});

	it('shows the file name when present', () => {
		const target = mountSection(ole({ fileName: 'budget.xlsx' }), createEditor());
		expect(target.textContent).toContain('budget.xlsx');
	});

	it('omits the file name row when absent', () => {
		const target = mountSection(ole(), createEditor());
		expect(target.textContent).not.toContain('File Name');
	});

	it('renders the current oleName in the Object Name field', () => {
		const target = mountSection(ole({ oleName: 'Q3 Budget' }), createEditor());
		const input = target.querySelector('input[type="text"]') as HTMLInputElement;
		expect(input.value).toBe('Q3 Budget');
	});

	it('commits a trimmed oleName patch on input', () => {
		const editor = createEditor();
		const target = mountSection(ole(), editor);
		const input = target.querySelector('input[type="text"]') as HTMLInputElement;
		input.value = '  Q3 Budget  ';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(editor.applyElementPatch).toHaveBeenCalledExactlyOnceWith('o1', {
			oleName: 'Q3 Budget',
		});
	});

	it('clears oleName when the field is emptied', () => {
		const editor = createEditor();
		const target = mountSection(ole({ oleName: 'Q3 Budget' }), editor);
		const input = target.querySelector('input[type="text"]') as HTMLInputElement;
		input.value = '';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(editor.applyElementPatch).toHaveBeenCalledExactlyOnceWith('o1', { oleName: undefined });
	});

	it('disables the Object Name field when the editor is not editable', () => {
		const target = mountSection(ole(), createEditor(false));
		const input = target.querySelector('input[type="text"]') as HTMLInputElement;
		expect(input.disabled).toBeTruthy();
	});
});
