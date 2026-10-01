import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ClipboardGroup from './ClipboardGroup.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountGroup() {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 10, height: 10 }] as never,
		},
	]);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ClipboardGroup, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const button = (id: string) =>
		target.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.clipboard.${id}"]`)!;
	return { editor, button, target };
}

describe('clipboardGroup', () => {
	it('renders the shared group and disables selection actions without a selection', () => {
		const { button, target } = mountGroup();
		expect(target.querySelector('[data-ribbon-group="home.clipboard"]')).not.toBeNull();
		expect(button('copy').disabled).toBeTruthy();
		expect(button('cut').disabled).toBeTruthy();
		expect(button('paste').disabled).toBeTruthy();
	});

	it('enables Copy and Cut for a selection and gates Cut when read-only', () => {
		const { editor, button } = mountGroup();
		editor.selection.setAll(['e1']);
		flushSync();
		expect(button('copy').disabled).toBeFalsy();
		expect(button('cut').disabled).toBeFalsy();
		editor.editable = false;
		flushSync();
		expect(button('copy').disabled).toBeFalsy();
		expect(button('cut').disabled).toBeTruthy();
	});
});
