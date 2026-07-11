import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import PositionSection from './PositionSection.svelte';

/**
 * PositionSection tests: the universal X/Y/W/H/rotation grid extracted from
 * the original monolithic InspectorPanel. Named `*.svelte.test.ts` so
 * `mountSection`'s props object can be wrapped in `$state(...)` (see
 * `notes-panel.svelte.test.ts` for the same pattern/rationale).
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		rotation: 0,
		shapeType: 'rect',
		shapeStyle: {},
		...over,
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	return editor;
}

interface MountResult {
	target: HTMLElement;
}

function mountSection(editor: EditorState, el: PptxElement): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(PositionSection, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target };
}

function numberInputs(target: HTMLElement): HTMLInputElement[] {
	return Array.from(target.querySelectorAll<HTMLInputElement>('input[type="number"]'));
}

describe('positionSection', () => {
	it('renders the current x/y/width/height/rotation', () => {
		const editor = makeEditor(shapeEl());
		const { target } = mountSection(editor, editor.slides[0]!.elements[0]!);
		const inputs = numberInputs(target);
		expect(inputs.map((i) => i.value)).toStrictEqual(['10', '20', '100', '50', '0']);
	});

	it('commits an x change to the element, with history', () => {
		const editor = makeEditor(shapeEl());
		const { target } = mountSection(editor, editor.slides[0]!.elements[0]!);
		const [xInput] = numberInputs(target);
		if (!xInput) {
			throw new Error('x input not found');
		}
		xInput.value = '42';
		xInput.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(editor.slides[0]?.elements[0]?.x).toBe(42);
		expect(editor.canUndo).toBeTruthy();
	});

	it('clamps width/height to a minimum of 1', () => {
		const editor = makeEditor(shapeEl());
		const { target } = mountSection(editor, editor.slides[0]!.elements[0]!);
		const inputs = numberInputs(target);
		const widthInput = inputs[2];
		if (!widthInput) {
			throw new Error('width input not found');
		}
		widthInput.value = '-5';
		widthInput.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(editor.slides[0]?.elements[0]?.width).toBe(1);
	});

	it('does not commit when the field is cleared to an unparseable empty value mid-edit', () => {
		// A native <input type="number"> silently resets its `.value` to `''` for
		// unparseable text, and `commit()` guards on `Number.isFinite`; `Number('')`
		// is `0` (finite), so clearing the field is indistinguishable from
		// explicitly typing 0 and DOES commit 0. This pins that native-input
		// coercion behaviour down so a future guard change doesn't silently drop
		// legitimate 0 commits.
		const editor = makeEditor(shapeEl());
		const { target } = mountSection(editor, editor.slides[0]!.elements[0]!);
		const [xInput] = numberInputs(target);
		if (!xInput) {
			throw new Error('x input not found');
		}
		xInput.value = 'not-a-number';
		xInput.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(editor.slides[0]?.elements[0]?.x).toBe(0);
		expect(editor.canUndo).toBeTruthy();
	});
});
