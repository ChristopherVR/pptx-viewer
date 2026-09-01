import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeFocusTargets,
	focusTargetChips,
	isTwoTableFocus,
	mergeTablesDirective,
} from './focus-targets';

/** A slide whose elements are given (id + type only matter here). */
function slide(index: number, els: { id: string; type: string }[]): PptxSlide {
	return {
		id: `slide-${index}`,
		slideNumber: index + 1,
		elements: els.map((e) => ({ ...e, x: 0, y: 0, width: 10, height: 10 })),
	} as unknown as PptxSlide;
}

describe('computeFocusTargets', () => {
	it('returns a whole-slide target when nothing is selected', () => {
		expect(
			computeFocusTargets({ activeSlideIndex: 2, selectedElementIds: [], selectedElementId: null }),
		).toStrictEqual([{ kind: 'slide', slideIndex: 2 }]);
	});

	it('returns one element target per selected id (multi-select, order preserved)', () => {
		expect(
			computeFocusTargets({
				activeSlideIndex: 1,
				selectedElementIds: ['a', 'b'],
				selectedElementId: 'a',
			}),
		).toStrictEqual([
			{ kind: 'element', slideIndex: 1, elementId: 'a' },
			{ kind: 'element', slideIndex: 1, elementId: 'b' },
		]);
	});

	it('falls back to the primary id when the multi-select list is empty', () => {
		expect(
			computeFocusTargets({
				activeSlideIndex: 0,
				selectedElementIds: [],
				selectedElementId: 'solo',
			}),
		).toStrictEqual([{ kind: 'element', slideIndex: 0, elementId: 'solo' }]);
	});
});

describe('focusTargetChips', () => {
	it('labels slide and element targets', () => {
		const slides = [slide(0, [{ id: 'rect-5', type: 'shape' }])];
		const chips = focusTargetChips(
			[
				{ kind: 'slide', slideIndex: 0 },
				{ kind: 'element', slideIndex: 0, elementId: 'rect-5' },
			],
			slides,
		);
		expect(chips.map((c) => c.label)).toStrictEqual(['Slide 1', 'Shape 5']);
		expect(chips[1].title).toBe('Shape: rect-5');
	});

	it('labels a missing element and title-cases smartArt/ole specially', () => {
		const slides = [slide(0, [{ id: 'sa-1', type: 'smartArt' }])];
		const chips = focusTargetChips(
			[
				{ kind: 'element', slideIndex: 0, elementId: 'sa-1' },
				{ kind: 'element', slideIndex: 0, elementId: 'gone-9' },
			],
			slides,
		);
		expect(chips[0].label).toBe('SmartArt 1');
		expect(chips[1].label).toBe('Element (missing)');
	});
});

describe('isTwoTableFocus', () => {
	const slides = [
		slide(0, [
			{ id: 't1', type: 'table' },
			{ id: 't2', type: 'table' },
			{ id: 's1', type: 'shape' },
		]),
	];

	it('detects exactly two tables on the same slide', () => {
		expect(
			isTwoTableFocus(
				[
					{ kind: 'element', slideIndex: 0, elementId: 't1' },
					{ kind: 'element', slideIndex: 0, elementId: 't2' },
				],
				slides,
			),
		).toStrictEqual({ slideIndex: 0, elementIdA: 't1', elementIdB: 't2' });
	});

	it('rejects a table + non-table pair', () => {
		expect(
			isTwoTableFocus(
				[
					{ kind: 'element', slideIndex: 0, elementId: 't1' },
					{ kind: 'element', slideIndex: 0, elementId: 's1' },
				],
				slides,
			),
		).toBeFalsy();
	});

	it('rejects a single target and a slide target', () => {
		expect(
			isTwoTableFocus([{ kind: 'element', slideIndex: 0, elementId: 't1' }], slides),
		).toBeFalsy();
		expect(isTwoTableFocus([{ kind: 'slide', slideIndex: 0 }], slides)).toBeFalsy();
	});
});

describe('mergeTablesDirective', () => {
	it('names both element ids and the one-indexed slide number', () => {
		const directive = mergeTablesDirective(0, 't1', 't2');
		expect(directive).toContain('elementIdA=t1');
		expect(directive).toContain('elementIdB=t2');
		expect(directive).toContain('slide 1');
		expect(directive).toContain('merge_tables');
	});
});
