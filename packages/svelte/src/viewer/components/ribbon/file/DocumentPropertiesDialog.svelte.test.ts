import type { PptxHandler } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import DocumentPropertiesDialog from './DocumentPropertiesDialog.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('document properties dialog', () => {
	it('shows live statistics and commits summary metadata', () => {
		const editor = new EditorState({
			getCurrent: () => 0,
			getHandler: () => ({ save: vi.fn() }) as unknown as PptxHandler,
		});
		editor.editable = true;
		editor.setSlides(
			[{ id: 's1', rId: 'rId1', slideNumber: 1, notes: 'note', elements: [] }],
			[],
			undefined,
			undefined,
			[],
			{ title: 'Original' },
		);
		const target = document.createElement('div');
		const onclose = vi.fn();
		const instance = mount(DocumentPropertiesDialog, { target, props: { editor, onclose } });
		cleanup = () => unmount(instance);

		const title = target.querySelector<HTMLInputElement>('input')!;
		title.value = 'Updated';
		title.dispatchEvent(new Event('input', { bubbles: true }));
		const statistics = [...target.querySelectorAll('nav button')].find((button) =>
			button.textContent?.includes('Statistics'),
		)! as HTMLButtonElement;
		statistics.click();
		flushSync();
		expect(target.textContent).toContain('1');

		const save = [...target.querySelectorAll('footer button')].find((button) =>
			button.textContent?.includes('Save'),
		)! as HTMLButtonElement;
		save.click();
		expect(editor.coreProperties?.title).toBe('Updated');
		expect(onclose).toHaveBeenCalledOnce();
	});
});
