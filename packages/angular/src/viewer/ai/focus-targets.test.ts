import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeFocusTargets, focusTargetChips, isTwoTableFocus } from '../../internal/shared-ai';
import type { PptxAiFocusedTarget } from '../../internal/shared-ai';

function el(id: string, type: PptxElement['type']): PptxElement {
	return { type, id, name: '', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements } as PptxSlide;
}

describe('computeFocusTargets', () => {
	it('returns a whole-slide target when nothing is selected', () => {
		expect(
			computeFocusTargets({ activeSlideIndex: 3, selectedElementIds: [], selectedElementId: null }),
		).toStrictEqual([{ kind: 'slide', slideIndex: 3 }]);
	});

	it('returns one element target per selected element, preserving order', () => {
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
});

describe('focusTargetChips', () => {
	it('renders a friendly Type + trailing number label and hides the raw id from the label', () => {
		const slides = [slide([el('ppt/slides/slide1.xml-shape-9', 'shape')])];
		const targets: PptxAiFocusedTarget[] = [
			{ kind: 'element', slideIndex: 0, elementId: 'ppt/slides/slide1.xml-shape-9' },
		];
		const [chip] = focusTargetChips(targets, slides);
		expect(chip.label).toBe('Shape 9');
		// The raw id is only exposed on hover (title), never in the visible label.
		expect(chip.label).not.toContain('ppt/slides');
		expect(chip.title).toContain('ppt/slides/slide1.xml-shape-9');
	});

	it('marks a target whose element is gone as (missing)', () => {
		const [chip] = focusTargetChips(
			[{ kind: 'element', slideIndex: 0, elementId: 'nope' }],
			[slide([])],
		);
		expect(chip.label).toBe('Element (missing)');
	});
});

describe('isTwoTableFocus', () => {
	it('detects exactly two tables on the same slide', () => {
		const slides = [slide([el('t1', 'table'), el('t2', 'table')])];
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

	it('is false when the two elements are not both tables', () => {
		const slides = [slide([el('t1', 'table'), el('s1', 'shape')])];
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
});
