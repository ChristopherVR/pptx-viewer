import type { PptxElement } from 'pptx-viewer-core';
import { DEFAULT_ROUND_RECT_ADJUSTMENT } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import type { EditorControllerDeps } from './editor-controller-deps';
import { EditorController } from './editor-controller.svelte';
import { EditorState } from './editor-state.svelte';

/**
 * The shape-adjustment drag (PowerPoint's amber diamond). Svelte had no such
 * gesture at all, so a round-rect's authored `a:avLst` corner radius was
 * unreachable on this binding's canvas.
 *
 * The drag must write `shapeAdjustments`, NEVER the element box: an adjustment
 * is a geometry parameter, not a resize.
 */

function roundRect(): PptxElement {
	return {
		type: 'shape',
		id: 'rr',
		x: 100,
		y: 50,
		width: 200,
		height: 120,
		rotation: 0,
		shapeType: 'roundRect',
	} as PptxElement;
}

function pointer(type: string, clientX: number): PointerEvent {
	return new PointerEvent(type, { clientX, clientY: 0, pointerId: 1, bubbles: true });
}

/**
 * The FIRST adjustment diamond of the selection, which is what the overlay
 * would hand the controller when the user grabs it. A preset has one per
 * `a:avLst` guide, so the gesture takes the descriptor rather than looking one
 * up: dragging a `quadArrow`'s second diamond must not move its first guide.
 */
function firstHandle(controller: EditorController) {
	const [descriptor] = controller.interactivity.adjust;
	return descriptor;
}

function setup(element: PptxElement): {
	editor: EditorState;
	controller: EditorController;
	dispose: () => void;
} {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element], notes: '' }]);
	const root = document.createElement('div');
	document.body.append(root);
	const controller = new EditorController(editor, {
		getScale: () => 1,
		getHolderEl: () => root as HTMLDivElement,
		getStageRoot: () => root,
		getRootEl: () => root,
		getPresenting: () => false,
	} as unknown as EditorControllerDeps);
	editor.select(element.id);
	return {
		editor,
		controller,
		dispose: () => {
			controller.destroy();
			root.remove();
		},
	};
}

/** The selected element's `shapeAdjustments`, or undefined. */
function adjustmentsOf(editor: EditorState): Record<string, number> | undefined {
	const element = editor.selectedElement;
	return element && 'shapeAdjustments' in element
		? (element.shapeAdjustments as Record<string, number> | undefined)
		: undefined;
}

describe('shape adjustment drag', () => {
	it('a drag delta writes a new shapeAdjustments.adj', () => {
		const { editor, controller, dispose } = setup(roundRect());
		expect(adjustmentsOf(editor)).toBeUndefined();

		controller.onAdjustPointerDown(pointer('pointerdown', 140), firstHandle(controller));
		window.dispatchEvent(pointer('pointermove', 180));
		window.dispatchEvent(pointer('pointerup', 180));

		const adjustments = adjustmentsOf(editor);
		expect(adjustments?.adj).toBeTypeOf('number');
		// Dragging outwards opens the radius past the round-rect default.
		expect(adjustments?.adj).toBeGreaterThan(DEFAULT_ROUND_RECT_ADJUSTMENT);
		expect(adjustments?.adj).toBeLessThanOrEqual(50000);
		dispose();
	});

	it('leaves the element box untouched (an adjustment is not a resize)', () => {
		const { editor, controller, dispose } = setup(roundRect());
		controller.onAdjustPointerDown(pointer('pointerdown', 140), firstHandle(controller));
		window.dispatchEvent(pointer('pointermove', 180));
		window.dispatchEvent(pointer('pointerup', 180));

		const element = editor.selectedElement;
		expect([element?.x, element?.y, element?.width, element?.height]).toStrictEqual([
			100, 50, 200, 120,
		]);
		dispose();
	});

	it('is one undo step, and undo restores the original adjustment', () => {
		const { editor, controller, dispose } = setup(roundRect());
		controller.onAdjustPointerDown(pointer('pointerdown', 140), firstHandle(controller));
		window.dispatchEvent(pointer('pointermove', 170));
		window.dispatchEvent(pointer('pointermove', 200));
		window.dispatchEvent(pointer('pointerup', 200));
		expect(adjustmentsOf(editor)?.adj).toBeGreaterThan(DEFAULT_ROUND_RECT_ADJUSTMENT);

		editor.undo();
		expect(adjustmentsOf(editor)).toBeUndefined();
		expect(editor.canUndo).toBeFalsy();
		dispose();
	});

	it('a tap inside the dead zone changes nothing', () => {
		const { editor, controller, dispose } = setup(roundRect());
		controller.onAdjustPointerDown(pointer('pointerdown', 140), firstHandle(controller));
		window.dispatchEvent(pointer('pointermove', 141));
		window.dispatchEvent(pointer('pointerup', 141));
		expect(adjustmentsOf(editor)).toBeUndefined();
		expect(editor.dirty).toBeFalsy();
		dispose();
	});

	it('offers no gesture on a plain rect', () => {
		const rect = { ...roundRect(), shapeType: 'rect' } as PptxElement;
		const { editor, controller, dispose } = setup(rect);
		expect(controller.interactivity.adjust).toStrictEqual([]);
		controller.onAdjustPointerDown(pointer('pointerdown', 140), firstHandle(controller));
		window.dispatchEvent(pointer('pointermove', 180));
		window.dispatchEvent(pointer('pointerup', 180));
		expect(adjustmentsOf(editor)).toBeUndefined();
		dispose();
	});

	it('offers no gesture when a:spLocks forbids adjust handles', () => {
		const locked = { ...roundRect(), locks: { noAdjustHandles: true } } as PptxElement;
		const { controller, dispose } = setup(locked);
		expect(controller.interactivity.adjust).toStrictEqual([]);
		dispose();
	});
});
