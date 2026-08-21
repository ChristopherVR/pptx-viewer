import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { EditorControllerDeps } from './editor-controller-deps';
import { EditorController } from './editor-controller.svelte';
import { EditorState } from './editor-state.svelte';

/**
 * Touch double-tap-to-edit on the editor canvas.
 *
 * Svelte relied entirely on native `dblclick`, which is not reliably
 * synthesised from two quick taps on mobile, so double-tap-to-edit did not
 * work on touch at all (React/Vue/Angular all track taps by hand for exactly
 * this reason). These cover the ported tap-bookkeeping (`#trackTap` /
 * `#handleDoubleTap`), mirroring Vue's `useCanvasPointer` test coverage.
 */

function shape(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		rotation: 0,
		shapeType: 'rect',
		text: 'hi',
	} as PptxElement;
}

function tableElement(id: string): PptxElement {
	const tableData: PptxTableData = {
		columnWidths: [0.5, 0.5],
		rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }],
	};
	return { type: 'table', id, x: 0, y: 0, width: 200, height: 60, tableData } as PptxElement;
}

function makeEditor(elements: PptxElement[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements, notes: '' }]);
	return editor;
}

function makeController(editor: EditorState): { controller: EditorController; root: HTMLElement } {
	const root = document.createElement('div');
	document.body.append(root);
	const controller = new EditorController(editor, {
		getScale: () => 1,
		getHolderEl: () => root as HTMLDivElement,
		getStageRoot: () => root,
		getRootEl: () => root,
		getPresenting: () => false,
	} as unknown as EditorControllerDeps);
	return { controller, root };
}

/** A `[data-element-id]` node the stage hit-test resolves to `id`. */
function stageNode(root: HTMLElement, id: string): HTMLElement {
	const node = document.createElement('div');
	node.setAttribute('data-element-id', id);
	node.setAttribute('data-pptx-element', 'true');
	root.append(node);
	return node;
}

function touchTap(target: HTMLElement, clientX: number, clientY: number): PointerEvent {
	const event = new PointerEvent('pointerdown', {
		clientX,
		clientY,
		pointerId: 1,
		pointerType: 'touch',
		bubbles: true,
	});
	Object.defineProperty(event, 'target', { value: target });
	return event;
}

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('svelte canvas touch double-tap', () => {
	it('a single tap selects the element without entering edit mode', () => {
		const editor = makeEditor([shape('a')]);
		const { controller, root } = makeController(editor);
		const node = stageNode(root, 'a');
		cleanup = () => {
			controller.destroy();
			root.remove();
		};

		controller.onStagePointerDown(touchTap(node, 30, 30));

		expect(editor.selectedElementId).toBe('a');
		expect(controller.editingId).toBeNull();
	});

	it('two quick taps on the same element enter inline edit', () => {
		const editor = makeEditor([shape('a')]);
		const { controller, root } = makeController(editor);
		const node = stageNode(root, 'a');
		cleanup = () => {
			controller.destroy();
			root.remove();
		};

		controller.onStagePointerDown(touchTap(node, 30, 30));
		controller.onStagePointerDown(touchTap(node, 31, 31));

		expect(controller.editingId).toBe('a');
	});

	it('two taps far apart in time do not enter edit mode', () => {
		const editor = makeEditor([shape('a')]);
		const { controller, root } = makeController(editor);
		const node = stageNode(root, 'a');
		cleanup = () => {
			controller.destroy();
			root.remove();
		};

		// `timeStamp` must be non-zero: `#trackTap` reads `event.timeStamp ||
		// Date.now()`, and `0` is falsy, so a literal 0 would fall through to
		// the real clock instead of the value under test.
		const first = touchTap(node, 30, 30);
		Object.defineProperty(first, 'timeStamp', { value: 1000 });
		controller.onStagePointerDown(first);

		const second = touchTap(node, 30, 30);
		Object.defineProperty(second, 'timeStamp', { value: 2000 }); // > DOUBLE_TAP_MS later
		controller.onStagePointerDown(second);

		expect(controller.editingId).toBeNull();
	});

	it('two taps on different, far-apart elements do not enter edit mode', () => {
		const editor = makeEditor([shape('a'), shape('b')]);
		const { controller, root } = makeController(editor);
		const nodeA = stageNode(root, 'a');
		const nodeB = stageNode(root, 'b');
		cleanup = () => {
			controller.destroy();
			root.remove();
		};

		controller.onStagePointerDown(touchTap(nodeA, 30, 30));
		controller.onStagePointerDown(touchTap(nodeB, 400, 400));

		expect(controller.editingId).toBeNull();
		// The second tap still behaves as an ordinary (non-double) tap: it selects.
		expect(editor.selectedElementId).toBe('b');
	});

	it('a double-tap on a table dispatches dblclick on the nearest cell', () => {
		const editor = makeEditor([tableElement('t')]);
		const { controller, root } = makeController(editor);
		const node = stageNode(root, 't');
		const cell = document.createElement('td');
		node.appendChild(cell);
		cell.getBoundingClientRect = () =>
			({ left: 0, top: 0, right: 40, bottom: 20, width: 40, height: 20 }) as DOMRect;
		let dblclicked = false;
		cell.addEventListener('dblclick', () => {
			dblclicked = true;
		});
		cleanup = () => {
			controller.destroy();
			root.remove();
		};

		controller.onStagePointerDown(touchTap(node, 20, 10));
		controller.onStagePointerDown(touchTap(node, 21, 11));

		expect(dblclicked).toBeTruthy();
		// The table element itself must not have entered plain inline-text edit.
		expect(controller.editingId).toBeNull();
	});
});
