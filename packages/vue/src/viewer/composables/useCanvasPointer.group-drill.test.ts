// oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks
/**
 * Selecting inside a group, driven through the REAL composables (shared
 * `group-drill` decides; this checks the Vue wiring asks it and acts on its
 * answer): the first press selects the group, a press on a member of the
 * selected group selects that member, a press on another member moves to it,
 * a click on the selected member's text opens the editor with the caret where
 * the click landed, a double-click goes straight to the member under the
 * pointer, and Escape steps back out to the group.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { takePendingCaretPoint } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, ref, shallowRef } from 'vue';

import { useElementStorePatch } from './element-store-patch';
import { useCanvasPointer } from './useCanvasPointer';
import { useEditorOperations } from './useEditorOperations';
import { useSelectionModel } from './useSelectionModel';

const card = (id: string, x: number) =>
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
const cards = {
	id: 'cards',
	type: 'group',
	x: 200,
	y: 100,
	width: 220,
	height: 60,
	children: [card('a', 0), card('b', 120)],
} as unknown as PptxElement;

const deck = (): PptxSlide[] => [{ id: 's1', elements: [cards] } as unknown as PptxSlide];

function setup(initialSelection: string | null, opts: { drill?: boolean } = {}) {
	const slides = shallowRef<PptxSlide[]>(deck());
	const activeSlide = computed(() => slides.value[0]);
	const selection = useSelectionModel({
		slides,
		templateElementsBySlideId: shallowRef({}),
		activeSlide,
	});
	if (initialSelection) {
		selection.selectElement(initialSelection, false);
	}
	const selectElement = vi.fn((id: string, additive: boolean) =>
		selection.selectElement(id, additive),
	);
	const enterInlineEdit = vi.fn();
	const clearSelection = vi.fn(() => selection.clearSelection());
	// Stand-in for `useElementDrag`: a release without a drag on an
	// already-selected element opens the inline editor.
	const startElementDrag = vi.fn((id: string, _event: PointerEvent, wasSelected: boolean) => {
		if (wasSelected) {
			pointer.requestElementEdit(id);
		}
	});
	const pointer = useCanvasPointer({
		canEdit: () => true,
		editTemplateMode: ref(false),
		findActiveElement: selection.findActiveElement,
		openEquationEditorForElement: () => false,
		enterInlineEdit,
		inlineEditingElementId: ref<string | null>(null),
		commitInlineEdit: vi.fn(),
		cancelInlineEdit: vi.fn(),
		formatPainterActive: ref(false),
		cancelFormatPainter: vi.fn(),
		applyFormatToTarget: vi.fn(),
		selectedElementIds: selection.selectedElementIds,
		selectElement,
		clearSelection,
		activeSlideIndex: ref(0),
		aiPickMode: ref(false),
		addAiPick: vi.fn(),
		startElementDrag,
		beginMarquee: vi.fn(),
		...(opts.drill === false
			? {}
			: {
					slideElements: () => activeSlide.value?.elements,
					canvasSize: () => ({ width: 960, height: 540 }),
				}),
	});
	return {
		slides,
		selection,
		pointer,
		selectElement,
		enterInlineEdit,
		clearSelection,
		startElementDrag,
	};
}

/**
 * The stage (at the origin, zoom 1) holding the group's DOM node. Grouped
 * children render inside the group with `pointer-events: none`, so a press
 * always targets the group node: the member is found by geometry.
 */
function groupNode(): HTMLElement {
	const stage = document.createElement('div');
	stage.setAttribute('aria-roledescription', 'slide');
	stage.getBoundingClientRect = () =>
		({
			left: 0,
			top: 0,
			right: 960,
			bottom: 540,
			width: 960,
			height: 540,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect;
	const host = document.createElement('div');
	host.setAttribute('data-element-id', 'cards');
	stage.appendChild(host);
	document.body.appendChild(stage);
	return host;
}

/** A primary-button mouse press at a slide point, dispatched on the group's node. */
function pressAt(handler: (event: PointerEvent) => void, x: number, y: number): void {
	const host = groupNode();
	host.addEventListener('pointerdown', (e) => handler(e as PointerEvent));
	const Ctor =
		typeof PointerEvent === 'function' ? PointerEvent : (MouseEvent as typeof PointerEvent);
	host.dispatchEvent(
		new Ctor('pointerdown', {
			bubbles: true,
			button: 0,
			clientX: x,
			clientY: y,
			pointerId: 1,
			pointerType: 'mouse',
		}),
	);
}

function doubleClickAt(handler: (event: MouseEvent) => void, x: number, y: number): void {
	const host = groupNode();
	host.addEventListener('dblclick', (e) => handler(e));
	host.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y }));
}

afterEach(() => {
	document.body.replaceChildren();
	takePendingCaretPoint();
});

describe('selecting inside a group', () => {
	it('selects the group on the first press, like PowerPoint', () => {
		const h = setup(null);
		pressAt(h.pointer.onCanvasPointerDown, 250, 130);
		expect(h.selectElement).toHaveBeenLastCalledWith('cards', false);
		expect(h.selection.selectedElementIds.value).toStrictEqual(['cards']);
	});

	it('selects the member under the pointer once the group is selected, without opening the editor', () => {
		const h = setup('cards');
		pressAt(h.pointer.onCanvasPointerDown, 250, 130);
		expect(h.selectElement).toHaveBeenLastCalledWith('a', false);
		expect(h.startElementDrag).toHaveBeenCalledWith('a', expect.anything(), false);
		expect(h.enterInlineEdit).not.toHaveBeenCalled();
	});

	it('moves to another member of the entered group', () => {
		const h = setup('a');
		pressAt(h.pointer.onCanvasPointerDown, 360, 130);
		expect(h.selectElement).toHaveBeenLastCalledWith('b', false);
	});

	it("opens the selected member's text with the caret where the click landed", () => {
		const h = setup('a');
		pressAt(h.pointer.onCanvasPointerDown, 230, 110);
		expect(h.selectElement).not.toHaveBeenCalled();
		expect(h.enterInlineEdit).toHaveBeenCalledWith('a');
		expect(takePendingCaretPoint()).toStrictEqual({ clientX: 230, clientY: 110 });
	});

	it('double-click goes straight to the member under the pointer and edits it', () => {
		const h = setup(null);
		doubleClickAt(h.pointer.onCanvasDoubleClick, 360, 130);
		expect(h.selectElement).toHaveBeenCalledWith('b', false);
		expect(h.enterInlineEdit).toHaveBeenCalledWith('b');
		// A double-click keeps the caret at the end (typing appends): no click point.
		expect(takePendingCaretPoint()).toBeNull();
	});

	it('escape steps a selected member out to its group, then clears', () => {
		const h = setup('b');
		h.pointer.onEscape();
		expect(h.selection.selectedElementIds.value).toStrictEqual(['cards']);
		expect(h.clearSelection).not.toHaveBeenCalled();
		h.pointer.onEscape();
		expect(h.clearSelection).toHaveBeenCalledOnce();
		expect(h.selection.selectedElementIds.value).toStrictEqual([]);
	});

	it('keeps selecting the group as one without the slide elements', () => {
		const h = setup('cards', { drill: false });
		pressAt(h.pointer.onCanvasPointerDown, 250, 130);
		expect(h.selectElement).not.toHaveBeenCalledWith('a', false);
	});

	it('does not enter a rotated group', () => {
		const h = setup('cards');
		h.slides.value = [
			{ id: 's1', elements: [{ ...cards, rotation: 30 } as PptxElement] } as PptxSlide,
		];
		pressAt(h.pointer.onCanvasPointerDown, 250, 130);
		expect(h.selectElement).not.toHaveBeenCalledWith('a', false);
	});
});

describe('a member selected inside its group', () => {
	it('resolves in slide space for the chrome, drag and inline editor', () => {
		const h = setup('b');
		const member = h.selection.findActiveElement('b');
		expect(member?.x).toBe(320);
		expect(member?.y).toBe(100);
		expect(h.selection.selectedElements.value.map((el) => el.id)).toStrictEqual(['b']);
	});

	it('writes a slide-space update back into the group', () => {
		const slides = ref<PptxSlide[]>(deck());
		const ops = useEditorOperations({
			slides,
			activeSlideIndex: ref(0),
			pushHistory: vi.fn(),
		});
		ops.updateElement('b', { x: 340, text: 'edited' } as Partial<PptxElement>);
		const group = slides.value[0].elements[0] as PptxElement & { children: PptxElement[] };
		expect(group.children[1].x).toBe(140);
		expect((group.children[1] as { text?: string }).text).toBe('edited');
		expect(slides.value[0].elements).toHaveLength(1);
	});

	it('lands a live drag where it was dropped (store patch in slide space)', () => {
		const slides = ref<PptxSlide[]>(deck());
		const patch = useElementStorePatch({
			slides,
			activeSlideIndex: ref(0),
			templateElementsBySlideId: ref({}),
		});
		patch('a', (el) => ({ ...el, x: 210, y: 150 }));
		const group = slides.value[0].elements[0] as PptxElement & { children: PptxElement[] };
		expect(group.children[0].x).toBe(10);
		expect(group.children[0].y).toBe(50);
		expect(group.x).toBe(200);
	});
});
