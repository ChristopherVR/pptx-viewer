import type { PptxElement, PptxShapeLocks } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorControllerDeps } from './editor-controller-deps';
import { createTransformGestures } from './editor-controller-wiring';
import type { EditorControllerHost } from './editor-controller-wiring';
import { EditorController } from './editor-controller.svelte';
import { canMoveElement, selectionInteractivity } from './editor-selection-interactivity';
import { EditorState } from './editor-state.svelte';
import { canInlineEditElement } from './inline-text';

/**
 * Regression suite for "shape LOCK enforcement is missing on the Svelte
 * canvas". `element.locks` was read in exactly one place in this binding
 * (`inline-text`'s `noTextEdit`), so `noSelect` / `noMove` / `noResize` /
 * `noRotation` from a real deck did nothing at all: a pinned masthead was as
 * draggable as any other shape.
 */

function shape(id: string, locks?: PptxShapeLocks): PptxElement {
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
		...(locks ? { locks } : {}),
	} as PptxElement;
}

function pointer(type: string, clientX: number, clientY: number): PointerEvent {
	return new PointerEvent(type, { clientX, clientY, pointerId: 1, bubbles: true });
}

/** An editor holding `elements` on one editable slide. */
function makeEditor(elements: PptxElement[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements, notes: '' }]);
	return editor;
}

function makeHost(editor: EditorState): EditorControllerHost {
	return {
		editor,
		deps: {
			getScale: () => 1,
			getHolderEl: () => null,
			getStageRoot: () => null,
			getPresenting: () => false,
		} as unknown as EditorControllerDeps,
		currentElements: () => editor.activeElements,
		setSnapLines: () => {},
		setMarquee: () => {},
		getEditingId: () => null,
	};
}

/** A controller over a stage root that hit-tests to `elementId`. */
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

describe('selectionInteractivity', () => {
	it('offers every affordance for an unlocked shape', () => {
		const verdict = selectionInteractivity([shape('a')]);
		expect(verdict.resizable).toBeTruthy();
		expect(verdict.rotatable).toBeTruthy();
	});

	it('withdraws the resize handles for noResize and the knob for noRotation', () => {
		expect(selectionInteractivity([shape('a', { noResize: true })]).resizable).toBeFalsy();
		// noResize gates exactly one gesture: rotating is still allowed.
		expect(selectionInteractivity([shape('a', { noResize: true })]).rotatable).toBeTruthy();
		expect(selectionInteractivity([shape('a', { noRotation: true })]).rotatable).toBeFalsy();
	});

	it('takes the strictest member of a multi-selection', () => {
		const verdict = selectionInteractivity([shape('a'), shape('b', { noResize: true })]);
		expect(verdict.resizable).toBeFalsy();
	});

	it('noSelect subsumes everything', () => {
		const verdict = selectionInteractivity([shape('a', { noSelect: true })]);
		expect(verdict).toMatchObject({ resizable: false, rotatable: false });
	});

	it('canMoveElement honours noMove but not noResize', () => {
		expect(canMoveElement(shape('a'))).toBeTruthy();
		expect(canMoveElement(shape('a', { noMove: true }))).toBeFalsy();
		expect(canMoveElement(shape('a', { noResize: true }))).toBeTruthy();
	});
});

describe('lock enforcement on the canvas', () => {
	it('a noSelect element is not selectable', () => {
		const editor = makeEditor([shape('locked', { noSelect: true }), shape('free')]);
		expect(editor.isElementInteractive('locked')).toBeFalsy();
		editor.select('locked');
		expect(editor.selectedElementId).toBeNull();

		editor.select('free');
		expect(editor.selectedElementId).toBe('free');
	});

	it('a noMove element still selects but arms no drag gesture', () => {
		const editor = makeEditor([shape('pinned', { noMove: true })]);
		const { controller, root } = makeController(editor);
		const node = stageNode(root, 'pinned');
		const host = makeHost(editor);
		const gestures = createTransformGestures(host);
		const begin = vi.spyOn(gestures, 'begin');

		const event = pointer('pointerdown', 30, 30);
		Object.defineProperty(event, 'target', { value: node });
		controller.onStagePointerDown(event);

		// Selected (so the inspector can unlock it) ...
		expect(editor.selectedElementId).toBe('pinned');
		// ... but the drag never starts: the element does not move.
		window.dispatchEvent(pointer('pointermove', 230, 230));
		window.dispatchEvent(pointer('pointerup', 230, 230));
		expect(editor.selectedElement?.x).toBe(10);
		expect(begin).not.toHaveBeenCalled();

		gestures.dispose();
		controller.destroy();
		root.remove();
	});

	it('an unlocked element under the same pointer-down DOES move', () => {
		const editor = makeEditor([shape('free')]);
		const { controller, root } = makeController(editor);
		const node = stageNode(root, 'free');

		const event = pointer('pointerdown', 30, 30);
		Object.defineProperty(event, 'target', { value: node });
		controller.onStagePointerDown(event);
		window.dispatchEvent(pointer('pointermove', 230, 230));
		window.dispatchEvent(pointer('pointerup', 230, 230));

		expect(editor.selectedElement?.x).toBe(210);
		controller.destroy();
		root.remove();
	});

	it('the overlay verdict hides the resize handles for a noResize selection', () => {
		const editor = makeEditor([shape('pinned', { noResize: true })]);
		const { controller, root } = makeController(editor);
		editor.select('pinned');
		expect(controller.interactivity.resizable).toBeFalsy();

		// And a synthetic handle pointer-down is refused too, not merely hidden.
		const event = pointer('pointerdown', 30, 30);
		controller.onHandlePointerDown('se', event);
		window.dispatchEvent(pointer('pointermove', 230, 230));
		window.dispatchEvent(pointer('pointerup', 230, 230));
		expect(editor.selectedElement?.width).toBe(100);

		controller.destroy();
		root.remove();
	});

	it('a noRotation selection refuses the rotate gesture', () => {
		const editor = makeEditor([shape('pinned', { noRotation: true })]);
		const { controller, root } = makeController(editor);
		editor.select('pinned');
		expect(controller.interactivity.rotatable).toBeFalsy();

		controller.onRotatePointerDown(pointer('pointerdown', 30, 30));
		window.dispatchEvent(pointer('pointermove', 230, 230));
		window.dispatchEvent(pointer('pointerup', 230, 230));
		expect(editor.selectedElement?.rotation).toBe(0);

		controller.destroy();
		root.remove();
	});

	it('inline text editing goes through the shared lock composition', () => {
		expect(canInlineEditElement(shape('a'))).toBeTruthy();
		expect(canInlineEditElement(shape('a', { noTextEdit: true }))).toBeFalsy();
		// The composition the hand-rolled `locks?.noTextEdit` check missed:
		// noSelect subsumes noTextEdit.
		expect(canInlineEditElement(shape('a', { noSelect: true }))).toBeFalsy();
	});
});
