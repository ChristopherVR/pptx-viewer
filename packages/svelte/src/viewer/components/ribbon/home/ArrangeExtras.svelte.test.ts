import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ArrangeExtras from './ArrangeExtras.svelte';

/**
 * G10: `a:spLocks`/`a:grpSpLocks`'s `@noGrp` disables the ribbon's Group and
 * Ungroup buttons, mirroring the guard `editor.arrangeOps.groupSelected` /
 * `ungroupSelected` already enforce on the commands themselves.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	return editor;
}

function mountExtras(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ArrangeExtras, { target, props: { editor } });
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

describe('arrangeExtras - group/ungroup lock gating', () => {
	it('disables Group when a:spLocks/@noGrp locks a selected element even with two selected', () => {
		const editor = makeEditor();
		editor.setSlides([
			{
				id: 's1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [
					{
						type: 'shape',
						id: 'a',
						x: 0,
						y: 0,
						width: 10,
						height: 10,
						shapeType: 'rect',
						locks: { noGrouping: true },
					},
					{ type: 'shape', id: 'b', x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' },
				],
			},
		]);
		editor.selection.setAll(['a', 'b']);
		const target = mountExtras(editor);

		expect(byLabel(target, 'Group')?.disabled).toBeTruthy();
	});

	it('enables Group for an unlocked two-element selection', () => {
		const editor = makeEditor();
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
		editor.selection.setAll(['a', 'b']);
		const target = mountExtras(editor);

		expect(byLabel(target, 'Group')?.disabled).toBeFalsy();
	});

	it('disables Ungroup when a:grpSpLocks/@noGrp is set on the group itself', () => {
		const editor = makeEditor();
		editor.setSlides([
			{
				id: 's1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [
					{
						type: 'group',
						id: 'g1',
						x: 0,
						y: 0,
						width: 10,
						height: 10,
						children: [],
						locks: { noGrouping: true },
					},
				],
			},
		]);
		editor.selection.set('g1');
		const target = mountExtras(editor);

		expect(byLabel(target, 'Ungroup')?.disabled).toBeTruthy();
	});
});
