import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	canGroupSelected,
	canGroupSelectionOnSlide,
	canUngroupGroup,
	canUngroupSelectionOnSlide,
	resolveContextMenuSelectionGroupable,
} from './group-lock-guard';

function shape(id: string, locks?: PptxElement['locks']): PptxElement {
	return { type: 'shape', id, name: '', x: 0, y: 0, width: 10, height: 10, locks } as PptxElement;
}

function group(id: string, locks?: PptxElement['locks']): PptxElement {
	return {
		type: 'group',
		id,
		name: '',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		children: [],
		locks,
	} as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements } as PptxSlide;
}

describe('canGroupSelected', () => {
	it('rejects the whole attempt when any selected shape carries a:spLocks/@noGrp', () => {
		const elements = [shape('a', { noGrouping: true }), shape('b')];
		expect(canGroupSelected(elements, ['a', 'b'])).toBeFalsy();
		expect(canGroupSelected(elements, ['b'])).toBeTruthy();
	});
});

describe('canUngroupGroup', () => {
	it('rejects a group whose own a:grpSpLocks/@noGrp is set', () => {
		expect(canUngroupGroup(group('g', { noGrouping: true }))).toBeFalsy();
		expect(canUngroupGroup(group('g'))).toBeTruthy();
	});
});

describe('canGroupSelectionOnSlide (classic EditorToolbarComponent)', () => {
	it('needs at least two selected ids', () => {
		const s = slide([shape('a'), shape('b')]);
		expect(canGroupSelectionOnSlide(s, ['a'])).toBeFalsy();
		expect(canGroupSelectionOnSlide(s, ['a', 'b'])).toBeTruthy();
	});

	it('rejects the attempt when a locked shape is selected', () => {
		const s = slide([shape('a', { noGrouping: true }), shape('b')]);
		expect(canGroupSelectionOnSlide(s, ['a', 'b'])).toBeFalsy();
	});
});

describe('canUngroupSelectionOnSlide (classic EditorToolbarComponent)', () => {
	it('needs exactly one selected id that is a group', () => {
		const s = slide([group('g'), shape('a')]);
		expect(canUngroupSelectionOnSlide(s, ['g'])).toBeTruthy();
		expect(canUngroupSelectionOnSlide(s, ['a'])).toBeFalsy();
		expect(canUngroupSelectionOnSlide(s, ['g', 'a'])).toBeFalsy();
	});

	it('rejects ungrouping when the group carries a:grpSpLocks/@noGrp', () => {
		const s = slide([group('g', { noGrouping: true })]);
		expect(canUngroupSelectionOnSlide(s, ['g'])).toBeFalsy();
	});
});

describe('resolveContextMenuSelectionGroupable (EditorContextMenuComponent)', () => {
	it('checks the single selected group own lock (the Ungroup case)', () => {
		const s = slide([group('g', { noGrouping: true })]);
		expect(resolveContextMenuSelectionGroupable(s, ['g'])).toBeFalsy();
		expect(resolveContextMenuSelectionGroupable(slide([group('g2')]), ['g2'])).toBeTruthy();
	});

	it('checks every selected element (the Group case)', () => {
		const s = slide([shape('a', { noGrouping: true }), shape('b')]);
		expect(resolveContextMenuSelectionGroupable(s, ['a', 'b'])).toBeFalsy();
		const unlocked = slide([shape('c'), shape('d')]);
		expect(resolveContextMenuSelectionGroupable(unlocked, ['c', 'd'])).toBeTruthy();
	});
});
