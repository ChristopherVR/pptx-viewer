// @vitest-environment happy-dom
/**
 * Selecting inside a group, driven through the REAL hook (shared `group-drill`
 * decides; this checks the handlers ask it, and act on its answer): the first
 * press selects the group, a press on a member of the selected group selects
 * that member, a press on another member moves to it, a click on the selected
 * member's text opens the editor with the caret where the click landed, and a
 * double-click goes straight to the member under the pointer.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { takePendingCaretPoint } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasInteractionHandlers } from './canvas-interaction-types';
import { useCanvasInteractions } from './useCanvasInteractions';
import type { UseCanvasInteractionsInput } from './useCanvasInteractions';

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
const slideElements: PptxElement[] = [cards];
const lookupFor = () =>
	new Map<string, PptxElement>([
		['cards', cards],
		['a', { ...card('a', 0), x: 200, y: 100 } as PptxElement],
		['b', { ...card('b', 120), x: 320, y: 100 } as PptxElement],
	]);

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

interface Harness {
	handlers: CanvasInteractionHandlers;
	applySelection: ReturnType<typeof vi.fn>;
	setInlineEditingElementId: ReturnType<typeof vi.fn>;
}

function mount(selectedId: string | null, opts: { drill?: boolean } = {}): Harness {
	const stage = document.createElement('div');
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
	const applySelection = vi.fn();
	const setInlineEditingElementId = vi.fn();
	const noop = (): void => undefined;
	const selected = selectedId ? [selectedId] : [];
	let captured: CanvasInteractionHandlers | null = null;
	const input = {
		mode: 'edit',
		canEdit: true,
		canvasSize: { width: 960, height: 540 },
		activeSlideIndex: 0,
		selectedElementId: selectedId,
		selectedElementIds: selected,
		selectedElementIdSet: new Set(selected),
		inlineEditingElementId: null,
		effectiveSelectedIds: selected,
		elementLookup: lookupFor(),
		...(opts.drill === false ? {} : { slideElements }),
		activeTool: 'select',
		editTemplateMode: false,
		editorScale: 1,
		canvasStageRef: { current: stage },
		dragStateRef: { current: null },
		resizeStateRef: { current: null },
		shapeAdjustmentDragStateRef: { current: null },
		marqueeStateRef: { current: null },
		justInteractedRef: { current: false },
		setInlineEditingElementId,
		setInlineEditingText: noop,
		setContextMenuState: noop,
		setCanvasContextMenuState: noop,
		setMarqueeSelectionState: noop,
		setSnapLines: noop,
		inlineEditingText: '',
		ops: {
			applySelection,
			clearSelection: vi.fn(),
			updateElementById: vi.fn(),
			updateSelectedTextStyle: vi.fn(),
		},
		history: { markDirty: vi.fn() },
		presentationHandleAction: noop,
		setEditingEquationOmml: noop,
		setIsEquationDialogOpen: noop,
		setPointerCommitNonce: vi.fn(),
	} as unknown as UseCanvasInteractionsInput;
	function Probe(): null {
		captured = useCanvasInteractions(input);
		return null;
	}
	act(() => root.render(<Probe />));
	if (!captured) {
		throw new Error('the hook produced no handlers');
	}
	return { handlers: captured, applySelection, setInlineEditingElementId };
}

/** A left-button press at a slide point (the stage sits at the origin, zoom 1). */
const at = (x: number, y: number) =>
	({
		button: 0,
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
		clientX: x,
		clientY: y,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	}) as unknown as React.MouseEvent;

describe('selecting inside a group', () => {
	it('selects the group on the first press, like PowerPoint', () => {
		const h = mount(null);
		h.handlers.handleElementMouseDown('cards', at(250, 130));
		expect(h.applySelection).toHaveBeenLastCalledWith('cards');
	});

	it('selects the member under the pointer once the group is selected, without opening the editor', () => {
		const h = mount('cards');
		h.handlers.handleElementMouseDown('cards', at(250, 130));
		h.handlers.handleElementClick('cards', at(250, 130));
		expect(h.applySelection).toHaveBeenCalledWith('a');
		expect(h.setInlineEditingElementId).not.toHaveBeenCalled();
	});

	it('moves to another member of the entered group', () => {
		const h = mount('a');
		h.handlers.handleElementMouseDown('cards', at(360, 130));
		expect(h.applySelection).toHaveBeenLastCalledWith('b');
	});

	it("opens the selected member's text with the caret where the click landed", () => {
		const h = mount('a');
		h.handlers.handleElementMouseDown('cards', at(230, 110));
		h.handlers.handleElementClick('cards', at(230, 110));
		expect(h.setInlineEditingElementId).toHaveBeenCalledWith('a');
		expect(takePendingCaretPoint()).toStrictEqual({ clientX: 230, clientY: 110 });
	});

	it('double-click goes straight to the member under the pointer', () => {
		const h = mount(null);
		h.handlers.handleElementDoubleClick('cards', at(360, 130));
		expect(h.applySelection).toHaveBeenCalledWith('b');
		expect(h.setInlineEditingElementId).toHaveBeenCalledWith('b');
	});

	it('keeps selecting the group as one without the slide elements (the hook alone)', () => {
		const h = mount('cards', { drill: false });
		h.handlers.handleElementMouseDown('cards', at(250, 130));
		expect(h.applySelection).not.toHaveBeenCalledWith('a');
	});
});
