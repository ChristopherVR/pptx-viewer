/**
 * Selecting inside a group, driven through the REAL stage interactions (shared
 * `group-drill` decides; this checks the stage asks it and acts on the answer):
 * the first press selects the group, a press on a member of the selected group
 * selects that member, a press on another member moves to it, a click on the
 * selected member's text opens the editor with the caret where the click
 * landed, a double-click goes straight to the member under the pointer, Escape
 * steps back out to the group, and the member's edits land in its group.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { setPendingCaretPoint } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { findActiveElement } from './editor-active-elements';
import { enteredGroupBox } from './editor-controller-overlay';
import { createEditorKeydownHandler } from './editor-keyboard';
import type { EditorKeyboardDeps } from './editor-keyboard';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import { createSelectionOverlay } from './selection-overlay';

vi.mock(import('pptx-viewer-shared'), async (original) => {
	const actual = await original();
	return { ...actual, setPendingCaretPoint: vi.fn(actual.setPendingCaretPoint) };
});

const card = (id: string, x: number) =>
	({
		id,
		type: 'text',
		x,
		y: 0,
		width: 100,
		height: 60,
		text: `${id} title`,
		textSegments: [{ text: `${id} title` }],
	}) as unknown as PptxElement;

/** A group at (200, 100) with two cards side by side (children are group-relative). */
const cardsGroup = (extra: Record<string, unknown> = {}) =>
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

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) {
		cleanup();
	}
	cleanups = [];
	vi.mocked(setPendingCaretPoint).mockClear();
});

function setup(selectedId: string | null, group: PptxElement = cardsGroup()) {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		selectedElementId: selectedId,
		selectedElementIds: selectedId ? [selectedId] : [],
		slides: [{ id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [group] }],
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: () => {} });

	// The rendered stage: grouped children carry their own ids but never get the
	// pointer, so the event target of a press on a card is the group node.
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const groupNode = document.createElement('div');
	groupNode.dataset.elementId = 'cards';
	for (const id of ['a', 'b']) {
		const child = document.createElement('div');
		child.dataset.elementId = id;
		groupNode.appendChild(child);
	}
	stage.appendChild(groupNode);
	const wrap = document.createElement('div');
	wrap.appendChild(stage);
	document.body.appendChild(wrap);

	const overlay = createSelectionOverlay(document, createTranslator(), {
		onHandlePointerDown: vi.fn(),
		onRotatePointerDown: vi.fn(),
		onAdjustPointerDown: vi.fn(),
	});
	overlay.mount(wrap);
	const interactions = createStageInteractions({
		doc: document,
		store,
		ops,
		// The overlay sits at the viewport origin (happy-dom), zoom 1: client
		// coordinates are slide coordinates.
		getScale: () => 1,
		getOverlay: () => overlay,
		getStageRoot: () => stage,
	});
	cleanups.push(() => {
		interactions.dispose();
		wrap.remove();
	});

	const at = (x: number, y: number) =>
		({
			button: 0,
			pointerId: 1,
			pointerType: 'mouse',
			timeStamp: 0,
			clientX: x,
			clientY: y,
			shiftKey: false,
			metaKey: false,
			ctrlKey: false,
			target: groupNode,
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		}) as unknown as PointerEvent;
	const press = (x: number, y: number) => interactions.onStagePointerDown(at(x, y));
	const release = (x: number, y: number) =>
		window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 1 }));
	const editorSurface = (): HTMLElement | null =>
		overlay.root.querySelector<HTMLElement>('[data-inline-editor]');

	return { store, ops, interactions, overlay, at, press, release, editorSurface };
}

describe('selecting inside a group', () => {
	it('selects the group on the first press, like PowerPoint', () => {
		const h = setup(null);
		h.press(250, 130);
		h.release(250, 130);
		expect(h.store.get().selectedElementId).toBe('cards');
		expect(h.editorSurface()).toBeNull();
	});

	it('selects the member under the pointer once the group is selected, without opening the editor', () => {
		const h = setup('cards');
		h.press(250, 130);
		h.release(250, 130);
		expect(h.store.get().selectedElementId).toBe('a');
		expect(h.store.get().selectedElementIds).toStrictEqual(['a']);
		expect(h.editorSurface()).toBeNull();
	});

	it('moves to another member of the entered group', () => {
		const h = setup('a');
		h.press(360, 130);
		h.release(360, 130);
		expect(h.store.get().selectedElementId).toBe('b');
		expect(h.editorSurface()).toBeNull();
	});

	it("opens the selected member's text with the caret where the click landed", () => {
		const h = setup('a');
		h.press(230, 110);
		expect(h.editorSurface()).toBeNull();
		h.release(230, 110);
		expect(h.editorSurface()).not.toBeNull();
		expect(h.store.get().selectedElementId).toBe('a');
		expect(setPendingCaretPoint).toHaveBeenLastCalledWith(
			expect.objectContaining({ clientX: 230, clientY: 110 }),
		);
		// The editor sits over the member's slide-space box, not its group-relative one.
		expect(h.editorSurface()?.style.left).toBe('200px');
		expect(h.editorSurface()?.style.top).toBe('100px');
	});

	it('does not open the editor when the press on the selected member drags it', () => {
		const h = setup('a');
		h.press(230, 110);
		h.release(260, 140);
		expect(h.editorSurface()).toBeNull();
	});

	it('double-click goes straight to the member under the pointer and edits it', () => {
		const h = setup(null);
		h.interactions.onStageDblClick(h.at(360, 130));
		expect(h.store.get().selectedElementId).toBe('b');
		expect(h.editorSurface()).not.toBeNull();
		// A double-click keeps the caret at the end (typing appends): no click point.
		expect(setPendingCaretPoint).toHaveBeenLastCalledWith(null);
	});

	it('keeps a rotated group whole: a press on it never selects a member', () => {
		const h = setup('cards', cardsGroup({ rotation: 30 }));
		h.press(250, 130);
		h.release(250, 130);
		expect(h.store.get().selectedElementId).toBe('cards');
		h.interactions.onStageDblClick(h.at(250, 130));
		expect(h.store.get().selectedElementId).toBe('cards');
	});
});

describe('a member selected inside its group', () => {
	it('resolves in slide space and frames its group', () => {
		const h = setup('b');
		const member = findActiveElement(h.store.get(), 'b');
		expect({ x: member?.x, y: member?.y }).toStrictEqual({ x: 320, y: 100 });
		const elements = h.store.get().slides[0].elements;
		expect(enteredGroupBox(elements, ['b'])).toStrictEqual({
			x: 200,
			y: 100,
			width: 220,
			height: 60,
			rotation: 0,
		});
		expect(enteredGroupBox(elements, ['cards'])).toBeNull();
		expect(enteredGroupBox(elements, ['a', 'b'])).toBeNull();
	});

	it('is moved in slide space and written back into its group', () => {
		const h = setup('b');
		h.ops.patchGeometry('b', { x: 340, y: 110, width: 100, height: 60, rotation: 0 });
		const group = h.store.get().slides[0].elements[0] as PptxElement & {
			children: PptxElement[];
		};
		expect(h.store.get().slides[0].elements).toHaveLength(1);
		expect({ x: group.children[1].x, y: group.children[1].y }).toStrictEqual({ x: 140, y: 10 });
		expect(findActiveElement(h.store.get(), 'b')?.x).toBe(340);
		h.ops.nudgeSelected(5, 0);
		expect(findActiveElement(h.store.get(), 'b')?.x).toBe(345);
	});

	it('commits its inline text into the group', () => {
		const h = setup('a');
		h.ops.commitInlineText('a', 'Renamed');
		const group = h.store.get().slides[0].elements[0] as PptxElement & {
			children: Array<PptxElement & { text?: string }>;
		};
		expect(group.children[0].text).toBe('Renamed');
		expect(group.children[0].x).toBe(0);
	});
});

describe('escape inside a group', () => {
	const deps = (overrides: Partial<EditorKeyboardDeps>): EditorKeyboardDeps => ({
		isActive: () => true,
		getSelectedId: () => 'a',
		deselect: vi.fn(),
		deleteSelected: vi.fn(),
		duplicateSelected: vi.fn(),
		copySelected: vi.fn(),
		cutSelected: vi.fn(),
		paste: vi.fn(),
		selectAll: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		nudgeSelected: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		cancelFormatPainter: () => false,
		toggleShortcuts: vi.fn(),
		closeShortcuts: () => false,
		...overrides,
	});
	const escape = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

	it('steps a member out to its group instead of clearing the selection', () => {
		const d = deps({ selectParent: vi.fn(() => true) });
		createEditorKeydownHandler(d)(escape());
		expect(d.selectParent).toHaveBeenCalledOnce();
		expect(d.deselect).not.toHaveBeenCalled();
	});

	it('clears a top-level selection', () => {
		const d = deps({ getSelectedId: () => 'cards', selectParent: vi.fn(() => false) });
		createEditorKeydownHandler(d)(escape());
		expect(d.deselect).toHaveBeenCalledOnce();
	});
});

describe('the entered group frame', () => {
	it('draws a dashed frame at the group box and hides it on null', () => {
		const overlay = createSelectionOverlay(document, createTranslator(), {
			onHandlePointerDown: vi.fn(),
			onRotatePointerDown: vi.fn(),
			onAdjustPointerDown: vi.fn(),
		});
		const frame = overlay.root.querySelector<HTMLElement>('[data-pptx-entered-group]');
		expect(frame?.hidden).toBeTruthy();
		overlay.setGroupFrame({ x: 200, y: 100, width: 220, height: 60, rotation: 0 }, 2);
		expect(frame?.hidden).toBeFalsy();
		expect([frame?.style.left, frame?.style.top, frame?.style.width]).toStrictEqual([
			'400px',
			'200px',
			'440px',
		]);
		overlay.setGroupFrame(null, 2);
		expect(frame?.hidden).toBeTruthy();
		overlay.destroy();
	});
});
