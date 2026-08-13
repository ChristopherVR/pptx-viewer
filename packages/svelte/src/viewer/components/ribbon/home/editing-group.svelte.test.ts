import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
import { EditorState } from '../../../editor/editor-state.svelte';
import EditingGroup from './EditingGroup.svelte';

/**
 * The Home tab's Editing group. The interesting part is Select: it used to be a
 * single button named "Select" that selected everything on click, so this
 * binding shipped no command called "Select All" and the cross-binding effects
 * spec had to skip it. It is now a trigger plus a menu, as in the other four.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [
				{ type: 'shape', id: 'a', x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' },
				{ type: 'shape', id: 'b', x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' },
			],
		},
	]);
	return editor;
}

function mountGroup(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const findReplace = new FindReplaceState({
		getSlides: () => editor.slides,
		commitSlides: () => {},
	});
	const instance = mount(EditingGroup, { target, props: { editor, findReplace } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function byLabel(target: HTMLElement, label: string): HTMLButtonElement | undefined {
	return [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.getAttribute('aria-label') === label,
	);
}

function byText(target: HTMLElement, text: string): HTMLButtonElement | undefined {
	return [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.textContent?.trim() === text,
	);
}

describe('editingGroup', () => {
	it('keeps the Select All command out of sight until Select is opened', () => {
		const target = mountGroup(makeEditor());

		expect(byText(target, 'Select All')).toBeUndefined();
		byLabel(target, 'Select')?.click();
		flushSync();
		expect(byText(target, 'Select All')).toBeTruthy();
	});

	it('selects every element on the slide from the menu', () => {
		const editor = makeEditor();
		const target = mountGroup(editor);

		byLabel(target, 'Select')?.click();
		flushSync();
		byText(target, 'Select All')?.click();
		flushSync();

		expect([...editor.selection.ids]).toStrictEqual(['a', 'b']);
		// The menu closes behind the command, like every other ribbon menu.
		expect(byText(target, 'Select All')).toBeUndefined();
	});
});
