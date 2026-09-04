import type { GroupPptxElement, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	alignSelectedOnSlide,
	distributeSelectedOnSlide,
	flipSelectedOnSlide,
	groupSelectedOnSlide,
	ungroupOnSlide,
} from './editor-arrange-ops';

function el(id: string, x: number, y: number, width = 10, height = 10): PptxElement {
	return { type: 'shape', id, x, y, width, height, shapeType: 'rect' } as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's', rId: 'rId-s', slideNumber: 1, elements };
}

describe('editor-arrange-ops alignSelectedOnSlide', () => {
	it('aligns the selected elements to the left edge', () => {
		const slides = [slide([el('a', 10, 0), el('b', 30, 5)])];
		const next = alignSelectedOnSlide(slides, 0, ['a', 'b'], 'left')!;
		expect(next[0].elements.map((e) => e.x)).toStrictEqual([10, 10]);
	});

	it('returns null (no-op) with fewer than 2 selected ids', () => {
		const slides = [slide([el('a', 10, 0)])];
		expect(alignSelectedOnSlide(slides, 0, ['a'], 'left')).toBeNull();
	});
});

describe('editor-arrange-ops distributeSelectedOnSlide', () => {
	it('distributes 3+ elements evenly, and is a no-op below the minimum', () => {
		const slides = [slide([el('a', 0, 0), el('b', 10, 0), el('c', 100, 0)])];
		expect(distributeSelectedOnSlide(slides, 0, ['a', 'b'], 'horizontal')).toBeNull();
		const next = distributeSelectedOnSlide(slides, 0, ['a', 'b', 'c'], 'horizontal');
		expect(next).not.toBeNull();
	});
});

describe('editor-arrange-ops flipSelectedOnSlide', () => {
	it('toggles flipHorizontal/flipVertical only on selected elements', () => {
		const slides = [slide([el('a', 0, 0), el('b', 0, 0)])];
		const next = flipSelectedOnSlide(slides, 0, ['a'], 'horizontal')!;
		expect(next[0].elements[0].flipHorizontal).toBeTruthy();
		expect(next[0].elements[1].flipHorizontal).toBeUndefined();
	});

	it('returns null when nothing is selected', () => {
		const slides = [slide([el('a', 0, 0)])];
		expect(flipSelectedOnSlide(slides, 0, [], 'horizontal')).toBeNull();
	});
});

describe('editor-arrange-ops group/ungroup', () => {
	it('groups two elements and can ungroup them back', () => {
		const slides = [slide([el('a', 0, 0), el('b', 20, 20)])];
		const grouped = groupSelectedOnSlide(slides, 0, ['a', 'b'])!;
		expect(grouped.groupId).toBeTruthy();
		const groupEl = grouped.slides[0].elements.find(
			(e) => e.id === grouped.groupId,
		) as GroupPptxElement;
		expect(groupEl.type).toBe('group');
		expect(groupEl.children).toHaveLength(2);

		const ungrouped = ungroupOnSlide(grouped.slides, 0, grouped.groupId)!;
		expect(ungrouped.childIds).toHaveLength(2);
		expect(ungrouped.slides[0].elements.map((e) => e.type)).toStrictEqual(['shape', 'shape']);
	});

	it('group returns null with fewer than 2 matching ids', () => {
		const slides = [slide([el('a', 0, 0)])];
		expect(groupSelectedOnSlide(slides, 0, ['a'])).toBeNull();
	});

	it('ungroup returns null for a non-group id', () => {
		const slides = [slide([el('a', 0, 0)])];
		expect(ungroupOnSlide(slides, 0, 'a')).toBeNull();
	});

	// G10 (OpenXML parity audit, D3): a:spLocks/a:grpSpLocks/@noGrouping was
	// parsed but never checked here.
	it('rejects the whole grouping attempt when a selected shape carries noGrouping', () => {
		const locked = { ...el('a', 0, 0), locks: { noGrouping: true } };
		const slides = [slide([locked, el('b', 20, 20)])];
		expect(groupSelectedOnSlide(slides, 0, ['a', 'b'])).toBeNull();
	});

	it('refuses to ungroup a group whose own noGrouping lock is set', () => {
		const slides = [slide([el('a', 0, 0), el('b', 20, 20)])];
		const grouped = groupSelectedOnSlide(slides, 0, ['a', 'b'])!;
		const lockedSlides: PptxSlide[] = [
			{
				...grouped.slides[0],
				elements: grouped.slides[0].elements.map((e) =>
					e.id === grouped.groupId ? { ...e, locks: { noGrouping: true } } : e,
				),
			},
		];
		expect(ungroupOnSlide(lockedSlides, 0, grouped.groupId)).toBeNull();
	});
});
