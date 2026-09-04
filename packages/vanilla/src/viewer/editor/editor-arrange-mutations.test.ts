import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	alignSelection,
	alignToCanvas,
	distributeSelection,
	flipElement,
	groupSelection,
	ungroupSelection,
} from './editor-arrange-mutations';

function box(id: string, x: number, y: number, width = 10, height = 10): PptxElement {
	return { type: 'shape', id, x, y, width, height, shapeType: 'rect' } as PptxElement;
}

describe('editor-arrange-mutations align/distribute', () => {
	it('aligns the selected elements left, leaving others untouched', () => {
		const elements = [box('a', 0, 0), box('b', 40, 10), box('c', 999, 999)];
		const result = alignSelection(elements, ['a', 'b'], 'left');
		expect(result.find((e) => e.id === 'a')?.x).toBe(0);
		expect(result.find((e) => e.id === 'b')?.x).toBe(0);
		expect(result.find((e) => e.id === 'c')?.x).toBe(999);
	});

	it('distributes three-plus selected elements evenly', () => {
		const elements = [box('a', 0, 0), box('b', 20, 0), box('c', 100, 0)];
		const result = distributeSelection(elements, ['a', 'b', 'c'], 'horizontal');
		// first/last pinned, middle repositioned to the even gap.
		expect(result.find((e) => e.id === 'a')?.x).toBe(0);
		expect(result.find((e) => e.id === 'c')?.x).toBe(100);
	});

	it('is a no-op for a single-element selection (documented limitation)', () => {
		const elements = [box('a', 5, 5)];
		expect(alignSelection(elements, ['a'], 'left')).toStrictEqual(elements);
	});
});

describe('editor-arrange-mutations alignToCanvas', () => {
	const canvas = { width: 960, height: 540 };

	it('aligns a single element to the slide edges/centre', () => {
		const el = box('a', 50, 50, 100, 60);
		expect(alignToCanvas(el, 'left', canvas)).toStrictEqual({ x: 0 });
		expect(alignToCanvas(el, 'right', canvas)).toStrictEqual({ x: 860 });
		expect(alignToCanvas(el, 'centerH', canvas)).toStrictEqual({ x: 430 });
		expect(alignToCanvas(el, 'top', canvas)).toStrictEqual({ y: 0 });
		expect(alignToCanvas(el, 'bottom', canvas)).toStrictEqual({ y: 480 });
		expect(alignToCanvas(el, 'middle', canvas)).toStrictEqual({ y: 240 });
	});
});

describe('editor-arrange-mutations flip', () => {
	it('toggles horizontal and vertical flip independently', () => {
		const el = box('a', 0, 0);
		expect(flipElement(el, 'horizontal')).toStrictEqual({ flipHorizontal: true });
		expect(flipElement(el, 'vertical')).toStrictEqual({ flipVertical: true });
	});
});

describe('editor-arrange-mutations group/ungroup', () => {
	it('groups two elements and can ungroup them back', () => {
		const elements = [box('a', 0, 0), box('b', 20, 20)];
		const grouped = groupSelection(elements, ['a', 'b'], 'g1');
		expect(grouped.groupId).toBe('g1');
		expect(grouped.elements).toHaveLength(1);

		const ungrouped = ungroupSelection(grouped.elements, 'g1', ['a2', 'b2']);
		expect(ungrouped.childIds).toStrictEqual(['a2', 'b2']);
		expect(ungrouped.elements).toHaveLength(2);
	});

	it('is a no-op when fewer than two ids are given (single-selection limitation)', () => {
		const elements = [box('a', 0, 0)];
		const result = groupSelection(elements, ['a'], 'g1');
		expect(result.groupId).toBeNull();
		expect(result.elements).toHaveLength(1);
	});

	// G10 (OpenXML parity audit, D3): a:spLocks/a:grpSpLocks/@noGrouping was
	// parsed but never checked here.
	it('rejects the whole grouping attempt when a selected shape carries noGrouping', () => {
		const locked = { ...box('a', 0, 0), locks: { noGrouping: true } };
		const elements = [locked, box('b', 20, 20)];
		const result = groupSelection(elements, ['a', 'b'], 'g1');
		expect(result.groupId).toBeNull();
		expect(result.elements).toHaveLength(2);
	});

	it('refuses to ungroup a group whose own noGrouping lock is set', () => {
		const lockedGroup = {
			...box('g', 0, 0),
			type: 'group' as const,
			children: [box('a', 0, 0), box('b', 20, 20)],
			locks: { noGrouping: true },
		};
		const result = ungroupSelection([lockedGroup] as PptxElement[], 'g', ['a2', 'b2']);
		expect(result.childIds).toStrictEqual([]);
		expect(result.elements).toHaveLength(1);
	});
});
