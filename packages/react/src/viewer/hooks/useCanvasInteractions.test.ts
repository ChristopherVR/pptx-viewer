import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect, vi } from 'vitest';

import type { CanvasInteractionHandlers } from './canvas-interaction-types';

// ---------------------------------------------------------------------------
// useCanvasInteractions is a complex hook that produces event handlers.
// We test:
//   1. The exported interface type shapes.
//   2. Pure decision logic extracted into testable functions below.
//   3. Element click multi-selection logic (re-implemented from the hook for
//      testing without React rendering).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Extracted pure logic: multi-select toggle
// ---------------------------------------------------------------------------

/**
 * Compute the new selection set after a shift/meta-click on an element.
 * Mirrors the logic in handleElementClick.
 */
function computeMultiSelectToggle(
	elementId: string,
	selectedElementIds: string[],
	selectedElementId: string | null,
): string[] {
	const ids = selectedElementIds.length
		? selectedElementIds
		: selectedElementId
			? [selectedElementId]
			: [];
	const newIds = ids.includes(elementId)
		? ids.filter((id) => id !== elementId)
		: [...ids, elementId];
	return newIds;
}

describe('computeMultiSelectToggle', () => {
	it('adds an element when not currently selected', () => {
		const result = computeMultiSelectToggle('el3', ['el1', 'el2'], null);
		expect(result).toStrictEqual(['el1', 'el2', 'el3']);
	});

	it('removes an element when already in multi-selection', () => {
		const result = computeMultiSelectToggle('el2', ['el1', 'el2', 'el3'], null);
		expect(result).toStrictEqual(['el1', 'el3']);
	});

	it('uses selectedElementId when selectedElementIds is empty', () => {
		const result = computeMultiSelectToggle('el2', [], 'el1');
		expect(result).toStrictEqual(['el1', 'el2']);
	});

	it('toggles off the only selected element', () => {
		const result = computeMultiSelectToggle('el1', [], 'el1');
		expect(result).toStrictEqual([]);
	});

	it('starts fresh selection when nothing is selected', () => {
		const result = computeMultiSelectToggle('el1', [], null);
		expect(result).toStrictEqual(['el1']);
	});

	it('removes the single element from multi-selection list', () => {
		const result = computeMultiSelectToggle('el1', ['el1'], null);
		expect(result).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Extracted pure logic: element lookup for click handling
// ---------------------------------------------------------------------------

/**
 * Determines whether an element should enter inline editing on click.
 * Mirrors the decision in handleElementClick.
 */
function shouldEnterInlineEdit(
	elementId: string,
	selectedElementIdSet: Set<string>,
	inlineEditingElementId: string | null,
	elementLookup: Map<string, PptxElement>,
): boolean {
	if (!selectedElementIdSet.has(elementId)) {
		return false;
	}
	if (inlineEditingElementId) {
		return false;
	}
	const el = elementLookup.get(elementId);
	if (!el) {
		return false;
	}
	// Check if element has text properties (type === 'text' or 'shape' with text)
	if (el.type !== 'text' && el.type !== 'shape') {
		return false;
	}
	if ((el as { locks?: { noTextEdit?: boolean } }).locks?.noTextEdit) {
		return false;
	}
	return true;
}

describe('shouldEnterInlineEdit', () => {
	const makeTextEl = (id: string, locks?: { noTextEdit?: boolean }): PptxElement =>
		({
			id,
			type: 'text',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: 'Hello',
			locks,
		}) as unknown as PptxElement;

	it('returns true when element is selected and has text', () => {
		const lookup = new Map<string, PptxElement>([['el1', makeTextEl('el1')]]);
		expect(shouldEnterInlineEdit('el1', new Set(['el1']), null, lookup)).toBeTruthy();
	});

	it('returns false when element is not selected', () => {
		const lookup = new Map<string, PptxElement>([['el1', makeTextEl('el1')]]);
		expect(shouldEnterInlineEdit('el1', new Set(), null, lookup)).toBeFalsy();
	});

	it('returns false when already inline editing', () => {
		const lookup = new Map<string, PptxElement>([['el1', makeTextEl('el1')]]);
		expect(shouldEnterInlineEdit('el1', new Set(['el1']), 'el1', lookup)).toBeFalsy();
	});

	it('returns false for non-text element types', () => {
		const imageEl = {
			id: 'img1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const lookup = new Map<string, PptxElement>([['img1', imageEl]]);
		expect(shouldEnterInlineEdit('img1', new Set(['img1']), null, lookup)).toBeFalsy();
	});

	it('returns false when noTextEdit lock is set', () => {
		const lookup = new Map<string, PptxElement>([['el1', makeTextEl('el1', { noTextEdit: true })]]);
		expect(shouldEnterInlineEdit('el1', new Set(['el1']), null, lookup)).toBeFalsy();
	});

	it('returns false when element not found in lookup', () => {
		const lookup = new Map<string, PptxElement>();
		expect(shouldEnterInlineEdit('missing', new Set(['missing']), null, lookup)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Extracted pure logic: equation elements route to the equation dialog
// ---------------------------------------------------------------------------

/**
 * Classify what a click-to-edit entry should do with a text-bearing element.
 * Mirrors `openEquationEditorForElement` + the inline-edit entry in
 * handleElementClick / handleElementDoubleClick: equation-bearing elements
 * must open the equation editor dialog; letting them into inline text
 * editing destroys the OMML on commit (the contentEditable only carries the
 * literal "[Equation]" placeholder text).
 */
function classifyTextEditEntry(el: PptxElement): 'equation-dialog' | 'inline-edit' {
	const segments = (el as { textSegments?: Array<{ equationXml?: Record<string, unknown> }> })
		.textSegments;
	const eqSeg = segments?.find((seg) => seg.equationXml);
	return eqSeg?.equationXml ? 'equation-dialog' : 'inline-edit';
}

describe('classifyTextEditEntry', () => {
	it('routes equation-bearing shapes to the equation dialog', () => {
		const el = {
			id: 'eq1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: '[Equation]',
			textSegments: [{ text: '[Equation]', style: {}, equationXml: { 'm:oMath': {} } }],
		} as unknown as PptxElement;
		expect(classifyTextEditEntry(el)).toBe('equation-dialog');
	});

	it('routes plain text shapes to inline editing', () => {
		const el = {
			id: 't1',
			type: 'text',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: 'Hello',
			textSegments: [{ text: 'Hello', style: {} }],
		} as unknown as PptxElement;
		expect(classifyTextEditEntry(el)).toBe('inline-edit');
	});
});

// ---------------------------------------------------------------------------
// Extracted pure logic: marquee selection coordinates
// ---------------------------------------------------------------------------

/**
 * Compute clamped marquee start coordinates.
 * Mirrors the logic in handleCanvasMouseDown.
 */
function computeMarqueeStart(
	clientX: number,
	clientY: number,
	rectLeft: number,
	rectTop: number,
	scale: number,
	canvasWidth: number,
	canvasHeight: number,
): { startX: number; startY: number } {
	const s = scale || 1;
	const startX = Math.max(0, Math.min(canvasWidth, (clientX - rectLeft) / s));
	const startY = Math.max(0, Math.min(canvasHeight, (clientY - rectTop) / s));
	return { startX, startY };
}

describe('computeMarqueeStart', () => {
	it('computes coordinates within bounds', () => {
		const result = computeMarqueeStart(150, 200, 50, 100, 1, 1280, 720);
		expect(result.startX).toBe(100);
		expect(result.startY).toBe(100);
	});

	it('clamps to minimum of 0', () => {
		const result = computeMarqueeStart(10, 20, 50, 100, 1, 1280, 720);
		expect(result.startX).toBe(0);
		expect(result.startY).toBe(0);
	});

	it('clamps to canvas maximum', () => {
		const result = computeMarqueeStart(2000, 1500, 0, 0, 1, 1280, 720);
		expect(result.startX).toBe(1280);
		expect(result.startY).toBe(720);
	});

	it('applies scale factor', () => {
		const result = computeMarqueeStart(200, 300, 0, 0, 2, 1280, 720);
		expect(result.startX).toBe(100);
		expect(result.startY).toBe(150);
	});

	it('uses fallback scale of 1 when scale is 0', () => {
		const result = computeMarqueeStart(200, 300, 0, 0, 0, 1280, 720);
		expect(result.startX).toBe(200);
		expect(result.startY).toBe(300);
	});
});

// ---------------------------------------------------------------------------
// Extracted pure logic: resize state initialization
// ---------------------------------------------------------------------------

/**
 * Build a resize state from element data.
 * Mirrors the data built in handleResizePointerDown.
 */
function buildResizeState(
	elementId: string,
	clientX: number,
	clientY: number,
	el: { x: number; y: number; width: number; height: number },
	handle: string,
) {
	return {
		elementId,
		startClientX: clientX,
		startClientY: clientY,
		startX: el.x,
		startY: el.y,
		startWidth: el.width,
		startHeight: el.height,
		handle: handle as 'nw' | 'ne' | 'sw' | 'se',
		moved: false,
		lastX: el.x,
		lastY: el.y,
		lastWidth: el.width,
		lastHeight: el.height,
	};
}

describe('buildResizeState', () => {
	it('captures initial element geometry', () => {
		const state = buildResizeState(
			'el1',
			400,
			300,
			{
				x: 100,
				y: 50,
				width: 200,
				height: 150,
			},
			'se',
		);
		expect(state.elementId).toBe('el1');
		expect(state.startX).toBe(100);
		expect(state.startY).toBe(50);
		expect(state.startWidth).toBe(200);
		expect(state.startHeight).toBe(150);
		expect(state.handle).toBe('se');
		expect(state.moved).toBeFalsy();
	});

	it('sets last values to initial element position', () => {
		const state = buildResizeState(
			'el2',
			0,
			0,
			{
				x: 50,
				y: 75,
				width: 300,
				height: 200,
			},
			'nw',
		);
		expect(state.lastX).toBe(50);
		expect(state.lastY).toBe(75);
		expect(state.lastWidth).toBe(300);
		expect(state.lastHeight).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// Extracted pure logic: drag-target IDs on element mousedown
// ---------------------------------------------------------------------------

/**
 * Compute which element IDs a drag should move when an element receives mousedown.
 * Mirrors the logic in handleElementMouseDown.
 *
 * Regression guard: if the clicked element wasn't already selected, the drag
 * must target only the clicked element. `effectiveSelectedIds` is the previous
 * render's selection because `applySelection` only schedules a React state
 * update - using it here would drag the previously-selected element while
 * focus moves to the new one.
 */
function computeMouseDownDragIds(
	elementId: string,
	selectedElementIdSet: Set<string>,
	effectiveSelectedIds: string[],
): string[] {
	const wasSelected = selectedElementIdSet.has(elementId);
	if (!wasSelected) {
		return [elementId];
	}
	return effectiveSelectedIds.length ? effectiveSelectedIds : [elementId];
}

describe('computeMouseDownDragIds', () => {
	it('drags only the clicked element when it was not already selected', () => {
		// Previously: dragging A, then clicking+dragging B would drag A because
		// `effectiveSelectedIds` was stale [A] when the mousedown handler ran.
		const result = computeMouseDownDragIds('B', new Set(['A']), ['A']);
		expect(result).toStrictEqual(['B']);
	});

	it('drags the current multi-selection when the clicked element is in it', () => {
		const result = computeMouseDownDragIds('B', new Set(['A', 'B', 'C']), ['A', 'B', 'C']);
		expect(result).toStrictEqual(['A', 'B', 'C']);
	});

	it('drags just the clicked element when it is the sole selection', () => {
		const result = computeMouseDownDragIds('A', new Set(['A']), ['A']);
		expect(result).toStrictEqual(['A']);
	});

	it('falls back to the clicked element when selection state is empty', () => {
		// Defensive path: selectedElementIdSet says it is selected but
		// effectiveSelectedIds is empty - drag the clicked element only.
		const result = computeMouseDownDragIds('A', new Set(['A']), []);
		expect(result).toStrictEqual(['A']);
	});
});

// ---------------------------------------------------------------------------
// CanvasInteractionHandlers type shape
// ---------------------------------------------------------------------------

describe('canvasInteractionHandlers type', () => {
	it('has all expected handler keys', () => {
		const handlers: CanvasInteractionHandlers = {
			handleElementClick: vi.fn<() => void>(),
			handleElementDoubleClick: vi.fn<() => void>(),
			handleElementMouseDown: vi.fn<() => void>(),
			handleElementContextMenu: vi.fn<() => void>(),
			handleCanvasMouseDown: vi.fn<() => void>(),
			handleResizePointerDown: vi.fn<() => void>(),
			handleAdjustmentPointerDown: vi.fn<() => void>(),
			handleRotate: vi.fn<() => void>(),
			handleUpdateSmartArtElement: vi.fn<() => void>(),
			handleFormatText: vi.fn<() => void>(),
			handleInlineEditCommit: vi.fn<() => void>(),
		};
		expect(Object.keys(handlers)).toHaveLength(11);
	});
});
