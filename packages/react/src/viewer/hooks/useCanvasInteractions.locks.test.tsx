// @vitest-environment happy-dom
/**
 * `a:spLocks` enforcement on the canvas, driven through the REAL hook.
 *
 * These assertions cannot be made against a re-implementation of the decision:
 * the whole defect class here is "the shared predicate exists and the pointer
 * handler does not call it", which only shows up when the production handler
 * runs. So the hook is mounted for real and its handlers are invoked with
 * synthetic pointer events, and the gesture refs it writes are inspected.
 *
 * Before the fix React honoured `noSelect` / `noResize` / `noRotation` but NOT
 * `noMove`: a shape the deck had pinned in place was fully draggable, and only
 * its cursor said otherwise.
 */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
	DragState,
	MarqueeSelectionState,
	ResizeState,
	ShapeAdjustmentDragState,
	ElementContextMenuState,
} from '../types';
import type { CanvasInteractionHandlers } from './canvas-interaction-types';
import { useCanvasInteractions } from './useCanvasInteractions';
import type { UseCanvasInteractionsInput } from './useCanvasInteractions';

function shape(id: string, locks?: PptxElement['locks']): PptxElement {
	return {
		id,
		type: 'shape',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		shapeType: 'roundRect',
		shapeAdjustments: { adj: 16667 },
		text: 'hello',
		locks,
	} as unknown as PptxElement;
}

interface Harness {
	handlers: CanvasInteractionHandlers;
	dragStateRef: React.MutableRefObject<DragState | null>;
	resizeStateRef: React.MutableRefObject<ResizeState | null>;
	adjustRef: React.MutableRefObject<ShapeAdjustmentDragState | null>;
	updateElementById: ReturnType<typeof vi.fn>;
}

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

/** Mount the real hook over one element and hand back its handlers + refs. */
function mount(element: PptxElement, selectedIds: string[] = [element.id]): Harness {
	const dragStateRef: React.MutableRefObject<DragState | null> = { current: null };
	const resizeStateRef: React.MutableRefObject<ResizeState | null> = { current: null };
	const adjustRef: React.MutableRefObject<ShapeAdjustmentDragState | null> = { current: null };
	const updateElementById = vi.fn();
	let captured: CanvasInteractionHandlers | null = null;

	const noop = (): void => undefined;
	const input: UseCanvasInteractionsInput = {
		mode: 'edit',
		canEdit: true,
		canvasSize: { width: 960, height: 540 },
		activeSlideIndex: 0,
		selectedElementId: selectedIds[0] ?? null,
		selectedElementIds: selectedIds,
		selectedElementIdSet: new Set(selectedIds),
		inlineEditingElementId: null,
		effectiveSelectedIds: selectedIds,
		elementLookup: new Map([[element.id, element]]),
		activeTool: 'select',
		editTemplateMode: false,
		editorScale: 1,
		canvasStageRef: { current: null },
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef: adjustRef,
		marqueeStateRef: { current: null } as React.MutableRefObject<MarqueeSelectionState | null>,
		justInteractedRef: { current: false },
		setInlineEditingElementId: noop,
		setInlineEditingText: noop,
		setContextMenuState: noop as React.Dispatch<
			React.SetStateAction<ElementContextMenuState | null>
		>,
		setMarqueeSelectionState: noop as React.Dispatch<
			React.SetStateAction<MarqueeSelectionState | null>
		>,
		setSnapLines: noop as React.Dispatch<
			React.SetStateAction<Array<{ axis: string; position: number }>>
		>,
		inlineEditingText: '',
		ops: {
			applySelection: vi.fn(),
			clearSelection: vi.fn(),
			updateElementById,
			updateSelectedTextStyle: vi.fn(),
		} as unknown as UseCanvasInteractionsInput['ops'],
		history: { markDirty: vi.fn() } as unknown as UseCanvasInteractionsInput['history'],
		presentationHandleAction: noop,
		setEditingEquationOmml: noop,
		setIsEquationDialogOpen: noop,
		setPointerCommitNonce: vi.fn(),
	};

	function Probe(): null {
		captured = useCanvasInteractions(input);
		return null;
	}

	act(() => root.render(<Probe />));
	if (!captured) {
		throw new Error('the hook produced no handlers');
	}
	return { handlers: captured, dragStateRef, resizeStateRef, adjustRef, updateElementById };
}

/** A left-button mouse event good enough for the handlers under test. */
function mouseEvent(): React.MouseEvent {
	return {
		button: 0,
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
		clientX: 100,
		clientY: 100,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	} as unknown as React.MouseEvent;
}

describe('canvas gestures honour a:spLocks', () => {
	it('arms a drag for an unlocked shape', () => {
		const harness = mount(shape('free'));
		harness.handlers.handleElementMouseDown('free', mouseEvent());
		expect(harness.dragStateRef.current).not.toBeNull();
	});

	it('refuses to arm a drag for a noMove shape', () => {
		const harness = mount(shape('pinned', { noMove: true }));
		harness.handlers.handleElementMouseDown('pinned', mouseEvent());
		expect(harness.dragStateRef.current).toBeNull();
	});

	it('drags only the movable members of a multi-selection', () => {
		const free = shape('free');
		const pinned = shape('pinned', { noMove: true });
		const dragStateRef: React.MutableRefObject<DragState | null> = { current: null };
		let captured: CanvasInteractionHandlers | null = null;
		const noop = (): void => undefined;
		function Probe(): null {
			captured = useCanvasInteractions({
				...({} as UseCanvasInteractionsInput),
				mode: 'edit',
				canEdit: true,
				canvasSize: { width: 960, height: 540 },
				activeSlideIndex: 0,
				selectedElementId: 'free',
				selectedElementIds: ['free', 'pinned'],
				selectedElementIdSet: new Set(['free', 'pinned']),
				inlineEditingElementId: null,
				effectiveSelectedIds: ['free', 'pinned'],
				elementLookup: new Map([
					['free', free],
					['pinned', pinned],
				]),
				activeTool: 'select',
				editTemplateMode: false,
				editorScale: 1,
				canvasStageRef: { current: null },
				dragStateRef,
				resizeStateRef: { current: null },
				shapeAdjustmentDragStateRef: { current: null },
				marqueeStateRef: { current: null },
				justInteractedRef: { current: false },
				setInlineEditingElementId: noop,
				setInlineEditingText: noop,
				setContextMenuState: noop,
				setMarqueeSelectionState: noop,
				setSnapLines: noop,
				inlineEditingText: '',
				ops: {
					applySelection: vi.fn(),
					clearSelection: vi.fn(),
					updateElementById: vi.fn(),
				} as unknown as UseCanvasInteractionsInput['ops'],
				history: { markDirty: vi.fn() } as unknown as UseCanvasInteractionsInput['history'],
				presentationHandleAction: noop,
				setEditingEquationOmml: noop,
				setIsEquationDialogOpen: noop,
			});
			return null;
		}
		act(() => root.render(<Probe />));
		captured!.handleElementMouseDown('free', mouseEvent());
		expect(Object.keys(dragStateRef.current?.startPositionsById ?? {})).toStrictEqual(['free']);
	});

	it('refuses to arm a resize for a noResize shape', () => {
		const locked = mount(shape('rigid', { noResize: true }));
		locked.handlers.handleResizePointerDown('rigid', mouseEvent(), 'se');
		expect(locked.resizeStateRef.current).toBeNull();

		const free = mount(shape('free'));
		free.handlers.handleResizePointerDown('free', mouseEvent(), 'se');
		expect(free.resizeStateRef.current).not.toBeNull();
	});

	it('refuses to rotate a noRotation shape', () => {
		const locked = mount(shape('fixed', { noRotation: true }));
		locked.handlers.handleRotate('fixed', 45);
		expect(locked.updateElementById).not.toHaveBeenCalled();

		const free = mount(shape('free'));
		free.handlers.handleRotate('free', 45);
		expect(free.updateElementById).toHaveBeenCalledWith('free', { rotation: 45 });
	});

	it('refuses the adjustment gesture for a noAdjustHandles shape', () => {
		const locked = mount(shape('plain', { noAdjustHandles: true }));
		locked.handlers.handleAdjustmentPointerDown('plain', mouseEvent());
		expect(locked.adjustRef.current).toBeNull();

		const free = mount(shape('free'));
		free.handlers.handleAdjustmentPointerDown('free', mouseEvent());
		expect(free.adjustRef.current).not.toBeNull();
	});

	it('lets noSelect subsume the others: nothing arms at all', () => {
		const harness = mount(shape('hidden', { noSelect: true }));
		harness.handlers.handleElementMouseDown('hidden', mouseEvent());
		harness.handlers.handleResizePointerDown('hidden', mouseEvent(), 'se');
		harness.handlers.handleAdjustmentPointerDown('hidden', mouseEvent());
		harness.handlers.handleRotate('hidden', 30);
		expect(harness.dragStateRef.current).toBeNull();
		expect(harness.resizeStateRef.current).toBeNull();
		expect(harness.adjustRef.current).toBeNull();
		expect(harness.updateElementById).not.toHaveBeenCalled();
	});
});
