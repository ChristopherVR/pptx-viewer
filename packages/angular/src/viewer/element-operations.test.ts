import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	updateElementById,
	moveElementBy,
	setElementPosition,
	resizeElement,
	deleteElementsByIds,
	duplicateElementById,
	bringToFront,
	sendToBack,
	bringForward,
	sendBackward,
} from './element-operations';

// ---------------------------------------------------------------------------
// Test factory
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<PptxElement> & { id: string }): PptxElement {
	return {
		type: 'shape',
		name: '',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		flipHorizontal: false,
		flipVertical: false,
		hidden: false,
		opacity: 1,
		rawXml: {},
		...overrides,
	} as PptxElement;
}

// Shorthand: build an ordered list of elements by id
function makeList(idList: string[]): PptxElement[] {
	return idList.map((id, i) => makeElement({ id, x: i * 10, y: i * 10 }));
}

// Collect ids in order from a list
function ids(elements: readonly PptxElement[]): string[] {
	return elements.map((el) => el.id);
}

// ---------------------------------------------------------------------------
// updateElementById
// ---------------------------------------------------------------------------

describe('updateElementById', () => {
	it('merges the patch onto the matching element', () => {
		const els = [makeElement({ id: 'a', x: 10, y: 20 }), makeElement({ id: 'b', x: 50 })];
		const result = updateElementById(els, 'a', { x: 99, hidden: true });
		expect(result[0].x).toBe(99);
		expect(result[0].hidden).toBeTruthy();
		expect(result[0].y).toBe(20); // untouched property preserved
	});

	it('preserves the discriminant type field even if patch carries a different one', () => {
		const els = [makeElement({ id: 'a' })];
		// Intentionally pass a patch with a mismatched type to verify it is overridden
		const result = updateElementById(els, 'a', { type: 'image' } as Partial<PptxElement>);
		// The original type must win
		expect(result[0].type).toBe('shape');
	});

	it('does not affect other elements', () => {
		const els = [makeElement({ id: 'a', x: 1 }), makeElement({ id: 'b', x: 2 })];
		const result = updateElementById(els, 'a', { x: 99 });
		expect(result[1].x).toBe(2);
	});

	it('is a no-op (returns same values) when id is not found', () => {
		const els = [makeElement({ id: 'a', x: 5 })];
		const result = updateElementById(els, 'missing', { x: 99 });
		expect(result[0].x).toBe(5);
	});

	it('returns a new array (input is immutable)', () => {
		const els = [makeElement({ id: 'a' })];
		const result = updateElementById(els, 'a', { x: 1 });
		expect(result).not.toBe(els);
	});

	it('does not mutate the original element object', () => {
		const el = makeElement({ id: 'a', x: 0 });
		const els = [el];
		updateElementById(els, 'a', { x: 42 });
		expect(el.x).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// moveElementBy
// ---------------------------------------------------------------------------

describe('moveElementBy', () => {
	it('adds dx/dy to the current x/y', () => {
		const els = [makeElement({ id: 'a', x: 10, y: 20 })];
		const result = moveElementBy(els, 'a', 5, -8);
		expect(result[0].x).toBe(15);
		expect(result[0].y).toBe(12);
	});

	it('handles zero deltas (no change)', () => {
		const els = [makeElement({ id: 'a', x: 10, y: 20 })];
		const result = moveElementBy(els, 'a', 0, 0);
		expect(result[0].x).toBe(10);
		expect(result[0].y).toBe(20);
	});

	it('handles negative deltas', () => {
		const els = [makeElement({ id: 'a', x: 50, y: 50 })];
		const result = moveElementBy(els, 'a', -30, -20);
		expect(result[0].x).toBe(20);
		expect(result[0].y).toBe(30);
	});

	it('is immutable', () => {
		const el = makeElement({ id: 'a', x: 0, y: 0 });
		const els = [el];
		moveElementBy(els, 'a', 10, 10);
		expect(el.x).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// setElementPosition
// ---------------------------------------------------------------------------

describe('setElementPosition', () => {
	it('replaces x and y absolutely', () => {
		const els = [makeElement({ id: 'a', x: 10, y: 20 })];
		const result = setElementPosition(els, 'a', 200, 300);
		expect(result[0].x).toBe(200);
		expect(result[0].y).toBe(300);
	});

	it('sets position to zero', () => {
		const els = [makeElement({ id: 'a', x: 50, y: 60 })];
		const result = setElementPosition(els, 'a', 0, 0);
		expect(result[0].x).toBe(0);
		expect(result[0].y).toBe(0);
	});

	it('is immutable', () => {
		const el = makeElement({ id: 'a', x: 5, y: 5 });
		setElementPosition([el], 'a', 100, 100);
		expect(el.x).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// resizeElement
// ---------------------------------------------------------------------------

describe('resizeElement', () => {
	it('sets width and height', () => {
		const els = [makeElement({ id: 'a', width: 100, height: 100 })];
		const result = resizeElement(els, 'a', 250, 80);
		expect(result[0].width).toBe(250);
		expect(result[0].height).toBe(80);
	});

	it('clamps width to minimum of 1', () => {
		const els = [makeElement({ id: 'a', width: 100, height: 100 })];
		const result = resizeElement(els, 'a', 0, 50);
		expect(result[0].width).toBe(1);
		expect(result[0].height).toBe(50);
	});

	it('clamps height to minimum of 1', () => {
		const els = [makeElement({ id: 'a', width: 100, height: 100 })];
		const result = resizeElement(els, 'a', 50, -10);
		expect(result[0].height).toBe(1);
	});

	it('clamps both dimensions when both are below minimum', () => {
		const els = [makeElement({ id: 'a', width: 100, height: 100 })];
		const result = resizeElement(els, 'a', -5, 0);
		expect(result[0].width).toBe(1);
		expect(result[0].height).toBe(1);
	});

	it('is immutable', () => {
		const el = makeElement({ id: 'a', width: 100, height: 100 });
		resizeElement([el], 'a', 200, 200);
		expect(el.width).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// deleteElementsByIds
// ---------------------------------------------------------------------------

describe('deleteElementsByIds', () => {
	it('removes elements whose id is in the set', () => {
		const els = makeList(['a', 'b', 'c']);
		const result = deleteElementsByIds(els, ['a', 'c']);
		expect(ids(result)).toStrictEqual(['b']);
	});

	it('leaves elements not in the id set unchanged', () => {
		const els = makeList(['a', 'b', 'c']);
		const result = deleteElementsByIds(els, ['b']);
		expect(ids(result)).toStrictEqual(['a', 'c']);
	});

	it('handles empty id list (no-op)', () => {
		const els = makeList(['a', 'b']);
		const result = deleteElementsByIds(els, []);
		expect(ids(result)).toStrictEqual(['a', 'b']);
	});

	it('handles ids not present in elements (no-op)', () => {
		const els = makeList(['a', 'b']);
		const result = deleteElementsByIds(els, ['z']);
		expect(ids(result)).toStrictEqual(['a', 'b']);
	});

	it('returns empty array when all elements are deleted', () => {
		const els = makeList(['a', 'b']);
		const result = deleteElementsByIds(els, ['a', 'b']);
		expect(result).toHaveLength(0);
	});

	it('is immutable (input array unchanged)', () => {
		const els = makeList(['a', 'b', 'c']);
		deleteElementsByIds(els, ['a']);
		expect(els).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// duplicateElementById
// ---------------------------------------------------------------------------

describe('duplicateElementById', () => {
	it('appends a copy with the given newId', () => {
		const els = [makeElement({ id: 'a', x: 10, y: 20 })];
		const result = duplicateElementById(els, 'a', 'a-copy');
		expect(result).toHaveLength(2);
		expect(result[1].id).toBe('a-copy');
	});

	it('nudges the copy by the default offset (20)', () => {
		const els = [makeElement({ id: 'a', x: 10, y: 30 })];
		const result = duplicateElementById(els, 'a', 'a-copy');
		expect(result[1].x).toBe(30);
		expect(result[1].y).toBe(50);
	});

	it('nudges by a custom offset when provided', () => {
		const els = [makeElement({ id: 'a', x: 0, y: 0 })];
		const result = duplicateElementById(els, 'a', 'a-copy', 5);
		expect(result[1].x).toBe(5);
		expect(result[1].y).toBe(5);
	});

	it('preserves all other properties from the source', () => {
		const els = [makeElement({ id: 'a', width: 300, height: 150, hidden: true })];
		const result = duplicateElementById(els, 'a', 'a-copy');
		expect(result[1].width).toBe(300);
		expect(result[1].height).toBe(150);
		expect(result[1].hidden).toBeTruthy();
	});

	it('copy has a distinct id from the original', () => {
		const els = [makeElement({ id: 'a' })];
		const result = duplicateElementById(els, 'a', 'new-id');
		expect(result[0].id).toBe('a');
		expect(result[1].id).toBe('new-id');
	});

	it('is a no-op when id is not found', () => {
		const els = makeList(['a', 'b']);
		const result = duplicateElementById(els, 'missing', 'copy');
		expect(ids(result)).toStrictEqual(['a', 'b']);
	});

	it('is immutable (input array unchanged)', () => {
		const els = makeList(['a']);
		duplicateElementById(els, 'a', 'a-copy');
		expect(els).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Z-order: bringToFront
// ---------------------------------------------------------------------------

describe('bringToFront', () => {
	it('moves the target to the last position', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(bringToFront(els, 'a'))).toStrictEqual(['b', 'c', 'a']);
	});

	it('is a no-op when already at front', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(bringToFront(els, 'c'))).toStrictEqual(['a', 'b', 'c']);
	});

	it('works for a single-element array', () => {
		const els = makeList(['a']);
		expect(ids(bringToFront(els, 'a'))).toStrictEqual(['a']);
	});

	it('handles id not found (no change)', () => {
		const els = makeList(['a', 'b']);
		expect(ids(bringToFront(els, 'z'))).toStrictEqual(['a', 'b']);
	});

	it('is immutable', () => {
		const els = makeList(['a', 'b', 'c']);
		bringToFront(els, 'a');
		expect(ids(els)).toStrictEqual(['a', 'b', 'c']);
	});
});

// ---------------------------------------------------------------------------
// Z-order: sendToBack
// ---------------------------------------------------------------------------

describe('sendToBack', () => {
	it('moves the target to index 0', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(sendToBack(els, 'c'))).toStrictEqual(['c', 'a', 'b']);
	});

	it('is a no-op when already at back', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(sendToBack(els, 'a'))).toStrictEqual(['a', 'b', 'c']);
	});

	it('handles id not found (no change)', () => {
		const els = makeList(['a', 'b']);
		expect(ids(sendToBack(els, 'z'))).toStrictEqual(['a', 'b']);
	});

	it('is immutable', () => {
		const els = makeList(['a', 'b', 'c']);
		sendToBack(els, 'c');
		expect(ids(els)).toStrictEqual(['a', 'b', 'c']);
	});
});

// ---------------------------------------------------------------------------
// Z-order: bringForward
// ---------------------------------------------------------------------------

describe('bringForward', () => {
	it('swaps element with the one above it', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(bringForward(els, 'a'))).toStrictEqual(['b', 'a', 'c']);
	});

	it('moves the middle element up by one', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(bringForward(els, 'b'))).toStrictEqual(['a', 'c', 'b']);
	});

	it('is a no-op when already at front', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(bringForward(els, 'c'))).toStrictEqual(['a', 'b', 'c']);
	});

	it('handles id not found', () => {
		const els = makeList(['a', 'b']);
		expect(ids(bringForward(els, 'z'))).toStrictEqual(['a', 'b']);
	});

	it('is immutable', () => {
		const els = makeList(['a', 'b', 'c']);
		bringForward(els, 'a');
		expect(ids(els)).toStrictEqual(['a', 'b', 'c']);
	});
});

// ---------------------------------------------------------------------------
// Z-order: sendBackward
// ---------------------------------------------------------------------------

describe('sendBackward', () => {
	it('swaps element with the one below it', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(sendBackward(els, 'c'))).toStrictEqual(['a', 'c', 'b']);
	});

	it('moves the middle element down by one', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(sendBackward(els, 'b'))).toStrictEqual(['b', 'a', 'c']);
	});

	it('is a no-op when already at back', () => {
		const els = makeList(['a', 'b', 'c']);
		expect(ids(sendBackward(els, 'a'))).toStrictEqual(['a', 'b', 'c']);
	});

	it('handles id not found', () => {
		const els = makeList(['a', 'b']);
		expect(ids(sendBackward(els, 'z'))).toStrictEqual(['a', 'b']);
	});

	it('is immutable', () => {
		const els = makeList(['a', 'b', 'c']);
		sendBackward(els, 'c');
		expect(ids(els)).toStrictEqual(['a', 'b', 'c']);
	});
});

// ---------------------------------------------------------------------------
// Cross-cutting: immutability of input array for all ops
// ---------------------------------------------------------------------------

describe('all ops are immutable', () => {
	it('updateElementById does not mutate the input array reference', () => {
		const els = makeList(['a', 'b']);
		const result = updateElementById(els, 'a', { x: 999 });
		expect(result).not.toBe(els);
		expect(els[0].x).not.toBe(999);
	});

	it('moveElementBy does not mutate the input array reference', () => {
		const els = makeList(['a']);
		const result = moveElementBy(els, 'a', 50, 50);
		expect(result).not.toBe(els);
	});

	it('setElementPosition does not mutate the input array reference', () => {
		const els = makeList(['a']);
		const result = setElementPosition(els, 'a', 999, 999);
		expect(result).not.toBe(els);
	});

	it('resizeElement does not mutate the input array reference', () => {
		const els = makeList(['a']);
		const result = resizeElement(els, 'a', 500, 500);
		expect(result).not.toBe(els);
	});

	it('bringToFront does not mutate the input array reference', () => {
		const els = makeList(['a', 'b']);
		const result = bringToFront(els, 'a');
		expect(result).not.toBe(els);
	});

	it('sendToBack does not mutate the input array reference', () => {
		const els = makeList(['a', 'b']);
		const result = sendToBack(els, 'b');
		expect(result).not.toBe(els);
	});

	it('bringForward does not mutate the input array reference', () => {
		const els = makeList(['a', 'b']);
		const result = bringForward(els, 'a');
		expect(result).not.toBe(els);
	});

	it('sendBackward does not mutate the input array reference', () => {
		const els = makeList(['a', 'b']);
		const result = sendBackward(els, 'b');
		expect(result).not.toBe(els);
	});
});
