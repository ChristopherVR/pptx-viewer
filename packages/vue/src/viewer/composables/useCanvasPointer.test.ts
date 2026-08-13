// oxlint-disable react-hooks/rules-of-hooks -- Vue composable, not a React hook
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useCanvasPointer } from './useCanvasPointer';

function shape(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100, ...overrides } as PptxElement;
}

function setup(elements: PptxElement[]) {
	const selectElement = vi.fn();
	const startElementDrag = vi.fn();
	const beginMarquee = vi.fn();
	const clearSelection = vi.fn();
	const pointer = useCanvasPointer({
		canEdit: () => true,
		editTemplateMode: ref(false),
		findActiveElement: (id) => elements.find((el) => el.id === id),
		openEquationEditorForElement: () => false,
		enterInlineEdit: vi.fn(),
		inlineEditingElementId: ref<string | null>(null),
		commitInlineEdit: vi.fn(),
		cancelInlineEdit: vi.fn(),
		formatPainterActive: ref(false),
		cancelFormatPainter: vi.fn(),
		applyFormatToTarget: vi.fn(),
		selectedElementIds: ref<string[]>([]),
		selectElement,
		clearSelection,
		activeSlideIndex: ref(0),
		aiPickMode: ref(false),
		addAiPick: vi.fn(),
		startElementDrag,
		beginMarquee,
	});
	return { pointer, selectElement, startElementDrag, beginMarquee, clearSelection };
}

/** Press the primary mouse button on a node carrying `data-element-id`. */
function pressOn(id: string, handler: (event: PointerEvent) => void): void {
	const host = document.createElement('div');
	host.setAttribute('data-element-id', id);
	document.body.appendChild(host);
	host.addEventListener('pointerdown', (e) => handler(e as PointerEvent));
	const Ctor =
		typeof PointerEvent === 'function' ? PointerEvent : (MouseEvent as typeof PointerEvent);
	host.dispatchEvent(
		new Ctor('pointerdown', {
			bubbles: true,
			button: 0,
			clientX: 5,
			clientY: 5,
			pointerId: 1,
			pointerType: 'mouse',
		}),
	);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('useCanvasPointer: a:spLocks enforcement', () => {
	// `noSelect` is PowerPoint's "this shape is not yours to touch". Vue read the
	// flag nowhere, so a locked shape selected (and then dragged) like any other.
	it('does not select an element locked with noSelect', () => {
		const { pointer, selectElement, startElementDrag, beginMarquee } = setup([
			shape('a', { locks: { noSelect: true } }),
		]);

		pressOn('a', pointer.onCanvasPointerDown);

		expect(selectElement).not.toHaveBeenCalled();
		expect(startElementDrag).not.toHaveBeenCalled();
		// A press on a locked shape falls through to the empty-canvas behaviour.
		expect(beginMarquee).toHaveBeenCalledWith(expect.anything());
	});

	it('still selects an unlocked element', () => {
		const { pointer, selectElement, startElementDrag } = setup([shape('a')]);

		pressOn('a', pointer.onCanvasPointerDown);

		expect(selectElement).toHaveBeenCalledWith('a', false);
		expect(startElementDrag).toHaveBeenCalledWith('a', expect.anything(), false);
	});

	// A pinned shape is still selectable: that is the only way for the user to
	// reach the inspector and unlock it again.
	it('selects a noMove element so it can be unlocked from the inspector', () => {
		const { pointer, selectElement } = setup([shape('a', { locks: { noMove: true } })]);

		pressOn('a', pointer.onCanvasPointerDown);

		expect(selectElement).toHaveBeenCalledWith('a', false);
	});
});
