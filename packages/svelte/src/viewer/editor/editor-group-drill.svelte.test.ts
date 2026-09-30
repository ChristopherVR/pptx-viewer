import type { PptxElement } from 'pptx-viewer-core';
import { takePendingCaretPoint } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { EditorControllerDeps } from './editor-controller-deps';
import { EditorController } from './editor-controller.svelte';
import { EditorState } from './editor-state.svelte';

/**
 * Selecting inside a group, driven through the REAL controller (shared
 * `group-drill` decides; this checks the handlers ask it and act on its
 * answer): the first press selects the group, a press on a member of the
 * selected group selects that member, a press on another member moves to it, a
 * click on the selected member's text opens the editor with the caret where
 * the click landed, a double-click goes straight to the member under the
 * pointer, and Escape steps back out one level. Mirrors React's
 * `useCanvasInteractions.group-drill.test.tsx`.
 */

const card = (id: string, x: number): PptxElement =>
	({
		id,
		type: 'shape',
		x,
		y: 0,
		width: 100,
		height: 60,
		shapeType: 'roundRect',
		text: `${id} title`,
	}) as unknown as PptxElement;

// A group at (200, 100) with two cards side by side (children are group-relative).
const cardsGroup = (extra: Record<string, unknown> = {}): PptxElement =>
	({
		id: 'cards',
		type: 'group',
		x: 200,
		y: 100,
		width: 220,
		height: 60,
		children: [card('a', 0), card('b', 120)],
		...extra,
	}) as unknown as PptxElement;

interface Harness {
	editor: EditorState;
	controller: EditorController;
	groupNode: HTMLElement;
}

let root: HTMLElement;
let controller: EditorController | undefined;

beforeEach(() => {
	root = document.createElement('div');
	document.body.append(root);
	takePendingCaretPoint();
});

afterEach(() => {
	controller?.destroy();
	controller = undefined;
	root.remove();
});

function mount(selectedId: string | null, group: PptxElement = cardsGroup()): Harness {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [group], notes: '' }]);
	if (selectedId) {
		editor.select(selectedId);
	}
	// The stage sits at the origin at zoom 1, so client px are slide px.
	controller = new EditorController(editor, {
		getScale: () => 1,
		getHolderEl: () => root as HTMLDivElement,
		getStageRoot: () => root,
		getRootEl: () => root,
		getPresenting: () => false,
	} as unknown as EditorControllerDeps);
	// Grouped children are `pointer-events: none`: the DOM target is the group.
	const groupNode = document.createElement('div');
	groupNode.setAttribute('data-element-id', 'cards');
	groupNode.setAttribute('data-pptx-element', 'true');
	root.append(groupNode);
	return { editor, controller, groupNode };
}

/** A left-button mouse press at a slide point, targeted at `target`. */
function press(target: HTMLElement, clientX: number, clientY: number): PointerEvent {
	const event = new PointerEvent('pointerdown', {
		clientX,
		clientY,
		button: 0,
		pointerId: 1,
		pointerType: 'mouse',
		bubbles: true,
	});
	Object.defineProperty(event, 'target', { value: target });
	return event;
}

function mouse(type: 'click' | 'dblclick', target: HTMLElement, x: number, y: number): MouseEvent {
	const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
	Object.defineProperty(event, 'target', { value: target });
	return event;
}

/** Press + release in place (no drag): pointerdown, pointerup, click. */
function clickAt(h: Harness, x: number, y: number): void {
	h.controller.onStagePointerDown(press(h.groupNode, x, y));
	window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 1 }));
	h.controller.onStageClick(mouse('click', h.groupNode, x, y));
}

const childOf = (editor: EditorState, id: string): PptxElement | undefined =>
	(editor.slides[0].elements[0] as unknown as { children: PptxElement[] }).children.find(
		(child) => child.id === id,
	);

describe('svelte selecting inside a group', () => {
	it('selects the group on the first press, like PowerPoint', () => {
		const h = mount(null);
		clickAt(h, 250, 130);
		expect(h.editor.selectedElementId).toBe('cards');
		expect(h.controller.enteredGroup).toBeNull();
	});

	it('selects the member under the pointer once the group is selected, without opening the editor', () => {
		const h = mount('cards');
		clickAt(h, 250, 130);
		expect(h.editor.selectedElementId).toBe('a');
		expect(h.controller.editingId).toBeNull();
	});

	it('moves to another member of the entered group', () => {
		const h = mount('a');
		h.controller.onStagePointerDown(press(h.groupNode, 360, 130));
		expect(h.editor.selectedElementId).toBe('b');
	});

	it("opens the selected member's text with the caret where the click landed", () => {
		const h = mount('a');
		clickAt(h, 230, 110);
		expect(h.controller.editingId).toBe('a');
		expect(takePendingCaretPoint()).toStrictEqual({ clientX: 230, clientY: 110 });
	});

	it('does not open the editor when the press on the selected member became a drag', () => {
		const h = mount('a');
		h.controller.onStagePointerDown(press(h.groupNode, 230, 110));
		h.controller.onStageClick(mouse('click', h.groupNode, 280, 110));
		expect(h.controller.editingId).toBeNull();
	});

	it('double-click goes straight to the member under the pointer', () => {
		const h = mount(null);
		h.controller.onStageDblClick(mouse('dblclick', h.groupNode, 360, 130));
		expect(h.editor.selectedElementId).toBe('b');
		expect(h.controller.editingId).toBe('b');
		// A double-click keeps the caret at the end (typing appends): no click point.
		expect(takePendingCaretPoint()).toBeNull();
	});

	it('escape steps out of the group, then clears the selection', () => {
		const h = mount('a');
		const escape = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
		h.controller.onKeyDown(escape());
		expect(h.editor.selectedElementId).toBe('cards');
		h.controller.onKeyDown(escape());
		expect(h.editor.selectedElementId).toBeNull();
	});

	it('keeps a rotated group as one: a press never drills into it', () => {
		const h = mount('cards', cardsGroup({ rotation: 30 }));
		clickAt(h, 250, 130);
		expect(h.editor.selectedElementId).toBe('cards');
	});
});

describe('svelte a selected group member in slide space', () => {
	it('resolves the member, its chrome and the entered group in slide space', () => {
		const h = mount('b');
		expect(h.editor.selectedElement).toMatchObject({ id: 'b', x: 320, y: 100 });
		expect(h.controller.overlayBox).toStrictEqual({
			x: 320,
			y: 100,
			width: 100,
			height: 60,
			rotation: 0,
		});
		expect(h.controller.enteredGroup).toMatchObject({ id: 'cards', x: 200, y: 100 });
	});

	it('writes a slide-space move back into the group', () => {
		const h = mount('a');
		h.editor.patchGeometry('a', { x: 250, y: 120, width: 100, height: 60, rotation: 0 });
		expect(childOf(h.editor, 'a')).toMatchObject({ x: 50, y: 20 });
		expect(h.editor.slides[0].elements).toHaveLength(1);
	});

	it('nudges a member inside its group', () => {
		const h = mount('b');
		h.editor.nudgeSelected(5, 0);
		expect(childOf(h.editor, 'b')).toMatchObject({ x: 125, y: 0 });
	});

	it('opens the inline editor over the member in slide space and commits into the group', () => {
		const h = mount('a');
		h.controller.enterInlineEdit('a');
		expect(h.controller.editingElement).toMatchObject({ id: 'a', x: 200, y: 100 });
		h.controller.commitInline('a', 'Renamed');
		h.controller.closeInline();
		expect(childOf(h.editor, 'a')).toMatchObject({ text: 'Renamed', x: 0, y: 0 });
	});
});
