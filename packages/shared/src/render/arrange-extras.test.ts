import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	DEFAULT_STROKE_WIDTH,
	strokeWidthOf,
} from './arrange-extras';

function shape(strokeWidth?: number): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
		shapeStyle: strokeWidth === undefined ? undefined : { strokeWidth },
	} as PptxElement;
}

function group(locks?: PptxElement['locks']): PptxElement {
	return {
		type: 'group',
		id: 'g1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		elements: [],
		locks,
	} as unknown as PptxElement;
}

describe('canGroupSelection', () => {
	it('requires an editable deck and at least two selected elements', () => {
		expect(canGroupSelection(true, 2)).toBeTruthy();
		expect(canGroupSelection(true, 1)).toBeFalsy();
		expect(canGroupSelection(false, 2)).toBeFalsy();
	});

	it('defaults selectionGroupable to true when the caller has no elements to check', () => {
		expect(canGroupSelection(true, 2)).toBeTruthy();
	});

	it('rejects the whole attempt when a:spLocks/@noGrp locks any selected element', () => {
		expect(canGroupSelection(true, 2, false)).toBeFalsy();
		expect(canGroupSelection(true, 2, true)).toBeTruthy();
	});
});

describe('canUngroupSelection', () => {
	it('requires an editable deck and a group selection', () => {
		expect(canUngroupSelection(true, group())).toBeTruthy();
		expect(canUngroupSelection(true, shape())).toBeFalsy();
		expect(canUngroupSelection(true, null)).toBeFalsy();
		expect(canUngroupSelection(false, group())).toBeFalsy();
	});

	it('rejects ungrouping when a:grpSpLocks/@noGrp is set on the group itself', () => {
		expect(canUngroupSelection(true, group({ noGrouping: true }))).toBeFalsy();
		expect(canUngroupSelection(true, group({ noGrouping: false }))).toBeTruthy();
	});
});

describe('canSetStrokeWidth', () => {
	it('requires an editable deck and a shape-property element', () => {
		expect(canSetStrokeWidth(true, shape())).toBeTruthy();
		expect(canSetStrokeWidth(true, null)).toBeFalsy();
		expect(canSetStrokeWidth(false, shape())).toBeFalsy();
	});
});

describe('strokeWidthOf', () => {
	it('reads the shape stroke width when set', () => {
		expect(strokeWidthOf(shape(3))).toBe(3);
	});

	it('defaults to DEFAULT_STROKE_WIDTH when unset or non-shape', () => {
		expect(strokeWidthOf(shape())).toBe(DEFAULT_STROKE_WIDTH);
		expect(strokeWidthOf(null)).toBe(DEFAULT_STROKE_WIDTH);
	});
});
