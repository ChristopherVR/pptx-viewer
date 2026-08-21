import type { PptxElement, PptxSmartArtData, SmartArtPptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import SmartArtSection from './SmartArtSection.svelte';

/**
 * A structural SmartArt edit (add / remove / promote / demote / reorder /
 * layout switch / diagram style) clears the cached `dsp` drawing shapes to
 * `[]`. React's inspector funnels every one of those through
 * `applySmartArtData`, which runs `rebuildDrawingShapesIfCleared` so the
 * richer cached-shape render path stays active. This panel never did, so a
 * single Add left the diagram on the crude family approximation for the rest
 * of the session.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** A real deck's cached PowerPoint `dsp` drawing. */
const CACHED: PptxSmartArtData['drawingShapes'] = [
	{ id: 'dsp1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 40, text: 'One' },
	{ id: 'dsp2', shapeType: 'roundRect', x: 0, y: 50, width: 100, height: 40, text: 'Two' },
];

function smartArt(): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
			],
			resolvedLayoutType: 'list',
			drawingShapes: CACHED,
		},
	} as PptxElement;
}

function render(): { editor: EditorState; target: HTMLElement } {
	const element = smartArt();
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select(element.id);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SmartArtSection, {
		target,
		props: { editor, el: element as SmartArtPptxElement },
	});
	flushSync();
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	return { editor, target };
}

function currentData(editor: EditorState): PptxSmartArtData | undefined {
	const element = editor.activeElements.find((candidate) => candidate.id === 'sa1');
	return element?.type === 'smartArt' ? element.smartArtData : undefined;
}

function clickButton(target: HTMLElement, label: string): void {
	const button = [...target.querySelectorAll('button')].find(
		(b) => b.textContent?.trim() === label,
	);
	button?.click();
	flushSync();
}

describe('smartArtSection structural reflow', () => {
	it('rebuilds the cached drawing shapes an Add cleared', () => {
		const { editor, target } = render();
		clickButton(target, 'Add');
		const data = currentData(editor);
		expect(data?.nodes).toHaveLength(3);
		// Without the reflow this is the empty array the core op left behind.
		expect(data?.drawingShapes).toHaveLength(3);
		expect(data?.drawingShapes?.[0]?.id).toBe('reflow-list-n1');
	});

	it('rebuilds after a layout switch', () => {
		const { editor, target } = render();
		target.querySelector<HTMLButtonElement>('[data-testid="smartart-layout-cycle"]')?.click();
		flushSync();
		const shapes = currentData(editor)?.drawingShapes ?? [];
		expect(shapes).toHaveLength(2);
		expect(shapes[0]?.id).toBe('reflow-cycle-n1');
	});

	it('leaves an intact cached drawing alone on a node-text edit', () => {
		const { editor, target } = render();
		const input = target.querySelector<HTMLInputElement>('[data-testid="smartart-node-text"]')!;
		input.value = 'Uno';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		const shapes = currentData(editor)?.drawingShapes ?? [];
		// The cached `dsp` drawing still wins: patched in place, never regenerated.
		expect(shapes.map((shape) => shape.id)).toStrictEqual(['dsp1', 'dsp2']);
		expect(shapes[0]?.text).toBe('Uno');
	});
});

function nodeInputs(target: HTMLElement): HTMLInputElement[] {
	return [...target.querySelectorAll<HTMLInputElement>('[data-testid="smartart-node-text"]')];
}

describe('smartArtSection keyboard editing', () => {
	it('enter key inserts a new sibling after the current node', () => {
		const { editor, target } = render();
		const [first] = nodeInputs(target);
		first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		const data = currentData(editor);
		expect(data?.nodes).toHaveLength(3);
		expect(data?.nodes[1]?.text).toBe('');
	});

	it('backspace key on an empty node removes it', () => {
		const { editor, target } = render();
		const inputs = nodeInputs(target);
		inputs[1].value = '';
		inputs[1].dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
		);
		flushSync();
		expect(currentData(editor)?.nodes).toHaveLength(1);
	});

	it('backspace key on a node with text does not remove it', () => {
		const { editor, target } = render();
		const [, second] = nodeInputs(target);
		second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
		flushSync();
		expect(currentData(editor)?.nodes).toHaveLength(2);
	});

	it('tab key demotes the node under its preceding sibling', () => {
		const { editor, target } = render();
		const [, second] = nodeInputs(target);
		second.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
		);
		flushSync();
		expect(currentData(editor)?.nodes.find((n) => n.id === 'n2')?.parentId).toBe('n1');
	});

	/**
	 * The input commits its text via `change` (blur-triggered), which never
	 * fires on Tab because the handler calls `preventDefault()`. A demote that
	 * read the last-committed (pre-edit) node text instead of the live input
	 * value silently discarded whatever the user had just typed.
	 */
	it('tab key commits the just-typed text before demoting, not just the demote', () => {
		const { editor, target } = render();
		const [, second] = nodeInputs(target);
		second.value = 'Two edited';
		second.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
		);
		flushSync();
		const node = currentData(editor)?.nodes.find((n) => n.id === 'n2');
		expect(node?.text).toBe('Two edited');
		expect(node?.parentId).toBe('n1');
	});

	/**
	 * The very first top-level node has no preceding sibling to nest under, so
	 * `demote` is a structural no-op (returns undefined) - and a version of the
	 * fix that only committed the edit ALONGSIDE a successful demote lost the
	 * typed text here specifically, since the whole branch was skipped. This is
	 * the exact scenario CI's save-corruption-repro / smartart-insert-edit
	 * specs exercise (they always edit the FIRST node).
	 */
	it('tab key on the first node (demote no-ops) still commits the just-typed text', () => {
		const { editor, target } = render();
		const [first] = nodeInputs(target);
		first.value = 'SmartArt One';
		first.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
		);
		flushSync();
		const node = currentData(editor)?.nodes.find((n) => n.id === 'n1');
		expect(node?.text).toBe('SmartArt One');
		expect(node?.parentId).toBeUndefined();
	});

	it('enter key commits the just-typed text before inserting a sibling', () => {
		const { editor, target } = render();
		const [first] = nodeInputs(target);
		first.value = 'One edited';
		first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		const data = currentData(editor);
		expect(data?.nodes.find((n) => n.id === 'n1')?.text).toBe('One edited');
		expect(data?.nodes).toHaveLength(3);
	});

	it('shift+tab promotes an already-nested node back to top level', () => {
		const element = smartArt() as SmartArtPptxElement;
		if (element.smartArtData) {
			element.smartArtData.nodes[1].parentId = 'n1';
		}
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = true;
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
		editor.select(element.id);
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(SmartArtSection, { target, props: { editor, el: element } });
		flushSync();
		cleanup = () => {
			void unmount(instance);
			target.remove();
		};

		const inputs = nodeInputs(target);
		inputs[1].dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
		);
		flushSync();
		expect(currentData(editor)?.nodes.find((n) => n.id === 'n2')?.parentId).toBeUndefined();
	});
});
