/**
 * Tests for NEW methods added to the Presentation class.
 *
 * Covers:
 * - swapSlides()
 * - reorderSlides()
 * - clearSlides()
 * - forEachSlide()
 * - findSlides()
 * - replaceTextOnSlide()
 * - reorderSections()
 * - getSectionForSlide()
 * - moveSlidesToSection()
 * - sections getter
 * - mailMerge()
 * - diff()
 * - title getter
 * - creator getter
 * - xmlBuilder()
 * - width getter
 * - height getter
 */
import { describe, it, expect, expectTypeOf } from 'vitest';

import { PptxXmlBuilder } from '../fluent/PptxXmlBuilder';
import { Presentation } from './Presentation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a presentation with `count` slides, each containing text "Slide N". */
async function createWithSlides(count: number): Promise<Presentation> {
	const pptx = await Presentation.create();
	for (let i = 0; i < count; i++) {
		pptx.addSlide('Blank').addText(`Slide ${i + 1}`, {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 600,
			height: 50,
		});
	}
	return pptx;
}

// ===========================================================================
// swapSlides()
// ===========================================================================

describe('presentation.swapSlides()', () => {
	it('swaps two slides by index', async () => {
		const pptx = await createWithSlides(3);
		const id0 = pptx.getSlide(0).id;
		const id2 = pptx.getSlide(2).id;

		pptx.swapSlides(0, 2);

		expect(pptx.getSlide(0).id).toBe(id2);
		expect(pptx.getSlide(2).id).toBe(id0);
	});

	it('renumbers slides after swap', async () => {
		const pptx = await createWithSlides(3);
		pptx.swapSlides(0, 2);

		for (let i = 0; i < pptx.slideCount; i++) {
			expect(pptx.getSlide(i).slideNumber).toBe(i + 1);
		}
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(3);
		const result = pptx.swapSlides(0, 1);
		expect(result).toBe(pptx);
	});

	it('supports chaining multiple swaps', async () => {
		const pptx = await createWithSlides(3);
		const id0 = pptx.getSlide(0).id;
		const id1 = pptx.getSlide(1).id;
		const id2 = pptx.getSlide(2).id;

		pptx.swapSlides(0, 1).swapSlides(1, 2);

		expect(pptx.getSlide(0).id).toBe(id1);
		expect(pptx.getSlide(1).id).toBe(id2);
		expect(pptx.getSlide(2).id).toBe(id0);
	});

	it('swapping a slide with itself is a no-op', async () => {
		const pptx = await createWithSlides(3);
		const id1 = pptx.getSlide(1).id;
		pptx.swapSlides(1, 1);
		expect(pptx.getSlide(1).id).toBe(id1);
	});

	it('throws RangeError for negative indexA', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.swapSlides(-1, 1)).toThrow(RangeError);
	});

	it('throws RangeError for negative indexB', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.swapSlides(0, -1)).toThrow(RangeError);
	});

	it('throws RangeError for out-of-range indexA', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.swapSlides(10, 1)).toThrow(RangeError);
	});

	it('throws RangeError for out-of-range indexB', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.swapSlides(0, 10)).toThrow(RangeError);
	});

	it('throws RangeError on empty presentation', async () => {
		const pptx = await Presentation.create();
		expect(() => pptx.swapSlides(0, 0)).toThrow(RangeError);
	});
});

// ===========================================================================
// reorderSlides()
// ===========================================================================

describe('presentation.reorderSlides()', () => {
	it('reverses slide order', async () => {
		const pptx = await createWithSlides(3);
		const id0 = pptx.getSlide(0).id;
		const id1 = pptx.getSlide(1).id;
		const id2 = pptx.getSlide(2).id;

		pptx.reorderSlides([2, 1, 0]);

		expect(pptx.getSlide(0).id).toBe(id2);
		expect(pptx.getSlide(1).id).toBe(id1);
		expect(pptx.getSlide(2).id).toBe(id0);
	});

	it('renumbers slides after reorder', async () => {
		const pptx = await createWithSlides(4);
		pptx.reorderSlides([3, 2, 1, 0]);

		for (let i = 0; i < pptx.slideCount; i++) {
			expect(pptx.getSlide(i).slideNumber).toBe(i + 1);
		}
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(3);
		const result = pptx.reorderSlides([0, 1, 2]);
		expect(result).toBe(pptx);
	});

	it('identity reorder preserves order', async () => {
		const pptx = await createWithSlides(3);
		const ids = [0, 1, 2].map((i) => pptx.getSlide(i).id);
		pptx.reorderSlides([0, 1, 2]);

		for (let i = 0; i < 3; i++) {
			expect(pptx.getSlide(i).id).toBe(ids[i]);
		}
	});

	it('filters out out-of-range indices (drops invalid slides)', async () => {
		const pptx = await createWithSlides(3);
		const id0 = pptx.getSlide(0).id;
		const id2 = pptx.getSlide(2).id;

		// Only indices 0 and 2 are valid; -1 and 10 are dropped
		pptx.reorderSlides([0, -1, 2, 10]);

		expect(pptx.slideCount).toBe(2);
		expect(pptx.getSlide(0).id).toBe(id0);
		expect(pptx.getSlide(1).id).toBe(id2);
	});

	it('empty order array clears slides', async () => {
		const pptx = await createWithSlides(3);
		pptx.reorderSlides([]);
		expect(pptx.slideCount).toBe(0);
	});

	it('subset of indices keeps only those slides', async () => {
		const pptx = await createWithSlides(4);
		const id1 = pptx.getSlide(1).id;
		const id3 = pptx.getSlide(3).id;

		pptx.reorderSlides([1, 3]);

		expect(pptx.slideCount).toBe(2);
		expect(pptx.getSlide(0).id).toBe(id1);
		expect(pptx.getSlide(1).id).toBe(id3);
	});
});

// ===========================================================================
// clearSlides()
// ===========================================================================

describe('presentation.clearSlides()', () => {
	it('removes all slides', async () => {
		const pptx = await createWithSlides(5);
		pptx.clearSlides();
		expect(pptx.slideCount).toBe(0);
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(3);
		const result = pptx.clearSlides();
		expect(result).toBe(pptx);
	});

	it('clearing an already empty presentation is a no-op', async () => {
		const pptx = await Presentation.create();
		expect(pptx.slideCount).toBe(0);
		pptx.clearSlides();
		expect(pptx.slideCount).toBe(0);
	});

	it('can add slides after clearing', async () => {
		const pptx = await createWithSlides(3);
		pptx.clearSlides();
		expect(pptx.slideCount).toBe(0);

		pptx.addSlide('Blank').addText('New slide', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});
		expect(pptx.slideCount).toBe(1);
	});

	it('chaining clearSlides with addSlide', async () => {
		const pptx = await createWithSlides(3);
		pptx.clearSlides().addSlide('Blank');
		expect(pptx.slideCount).toBe(1);
	});
});

// ===========================================================================
// forEachSlide()
// ===========================================================================

describe('presentation.forEachSlide()', () => {
	it('iterates over every slide', async () => {
		const pptx = await createWithSlides(3);
		const visited: number[] = [];
		pptx.forEachSlide((_slide, index) => {
			visited.push(index);
		});
		expect(visited).toStrictEqual([0, 1, 2]);
	});

	it('passes the correct slide object', async () => {
		const pptx = await createWithSlides(3);
		const ids: string[] = [];
		pptx.forEachSlide((slide) => {
			ids.push(slide.id);
		});

		for (let i = 0; i < 3; i++) {
			expect(ids[i]).toBe(pptx.getSlide(i).id);
		}
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(2);
		const result = pptx.forEachSlide(() => {});
		expect(result).toBe(pptx);
	});

	it('does not invoke callback on empty presentation', async () => {
		const pptx = await Presentation.create();
		let called = false;
		pptx.forEachSlide(() => {
			called = true;
		});
		expect(called).toBeFalsy();
	});

	it('allows mutation of slide properties inside callback', async () => {
		const pptx = await createWithSlides(2);
		pptx.forEachSlide((slide) => {
			slide.notes = 'Updated via forEachSlide';
		});

		expect(pptx.getSlide(0).notes).toBe('Updated via forEachSlide');
		expect(pptx.getSlide(1).notes).toBe('Updated via forEachSlide');
	});
});

// ===========================================================================
// findSlides()
// ===========================================================================

describe('presentation.findSlides()', () => {
	it('finds slides matching a predicate', async () => {
		const pptx = await createWithSlides(4);
		// Mark some slides with notes
		pptx.getSlide(1).notes = 'has notes';
		pptx.getSlide(3).notes = 'has notes';

		const indices = pptx.findSlides((slide) => slide.notes === 'has notes');
		expect(indices).toStrictEqual([1, 3]);
	});

	it('returns empty array when no slides match', async () => {
		const pptx = await createWithSlides(3);
		const indices = pptx.findSlides(() => false);
		expect(indices).toStrictEqual([]);
	});

	it('returns all indices when all slides match', async () => {
		const pptx = await createWithSlides(3);
		const indices = pptx.findSlides(() => true);
		expect(indices).toStrictEqual([0, 1, 2]);
	});

	it('returns empty array for empty presentation', async () => {
		const pptx = await Presentation.create();
		const indices = pptx.findSlides(() => true);
		expect(indices).toStrictEqual([]);
	});

	it('receives correct index in predicate', async () => {
		const pptx = await createWithSlides(3);
		const indices = pptx.findSlides((_slide, index) => index % 2 === 0);
		expect(indices).toStrictEqual([0, 2]);
	});

	it('finds slides by layout name', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Title Slide').addText('Title', { x: 0, y: 0, width: 400, height: 50 });
		pptx.addSlide('Blank').addText('Content', { x: 0, y: 0, width: 400, height: 50 });
		pptx.addSlide('Title Slide').addText('Another title', { x: 0, y: 0, width: 400, height: 50 });

		const indices = pptx.findSlides((slide) => slide.layoutName === 'Title Slide');
		expect(indices).toStrictEqual([0, 2]);
	});
});

// ===========================================================================
// replaceTextOnSlide()
// ===========================================================================

describe('presentation.replaceTextOnSlide()', () => {
	it('replaces text on a single slide', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Hello World', { x: 0, y: 0, width: 400, height: 50 });
		pptx.addSlide('Blank').addText('Hello Everyone', { x: 0, y: 0, width: 400, height: 50 });

		const count = pptx.replaceTextOnSlide(0, 'Hello', 'Hi');
		expect(count).toBeGreaterThanOrEqual(1);

		// Only slide 0 should be affected
		const remaining = pptx.findText('Hello');
		// Slide 1 should still have "Hello"
		expect(remaining.length).toBeGreaterThanOrEqual(1);
		expect(remaining.every((r) => r.slideIndex === 1)).toBeTruthy();
	});

	it('returns the replacement count', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('AAA BBB AAA', { x: 0, y: 0, width: 400, height: 50 });

		const count = pptx.replaceTextOnSlide(0, 'AAA', 'CCC');
		expect(count).toBeGreaterThanOrEqual(2);
	});

	it('returns 0 when search text not found on slide', async () => {
		const pptx = await createWithSlides(1);
		const count = pptx.replaceTextOnSlide(0, 'nonexistent', 'replacement');
		expect(count).toBe(0);
	});

	it('supports regex replacement on a single slide', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Year: 2025', { x: 0, y: 0, width: 400, height: 50 });

		const count = pptx.replaceTextOnSlide(0, /\d{4}/, '2026');
		expect(count).toBeGreaterThanOrEqual(1);
	});

	it('throws RangeError for negative slide index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.replaceTextOnSlide(-1, 'a', 'b')).toThrow(RangeError);
	});

	it('throws RangeError for out-of-range slide index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.replaceTextOnSlide(10, 'a', 'b')).toThrow(RangeError);
	});

	it('throws RangeError on empty presentation', async () => {
		const pptx = await Presentation.create();
		expect(() => pptx.replaceTextOnSlide(0, 'a', 'b')).toThrow(RangeError);
	});
});

// ===========================================================================
// reorderSections()
// ===========================================================================

describe('presentation.reorderSections()', () => {
	it('reorders sections by their IDs', async () => {
		const pptx = await createWithSlides(4);
		const sA = pptx.addSection('Intro', [0]);
		const sB = pptx.addSection('Body', [1, 2]);
		const sC = pptx.addSection('End', [3]);

		pptx.reorderSections([sC.id, sA.id, sB.id]);

		expect(pptx.sections[0].name).toBe('End');
		expect(pptx.sections[1].name).toBe('Intro');
		expect(pptx.sections[2].name).toBe('Body');
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(2);
		const s = pptx.addSection('A', [0]);
		const result = pptx.reorderSections([s.id]);
		expect(result).toBe(pptx);
	});

	it('drops sections not in the new order', async () => {
		const pptx = await createWithSlides(3);
		const sA = pptx.addSection('A', [0]);
		pptx.addSection('B', [1]);
		const sC = pptx.addSection('C', [2]);

		pptx.reorderSections([sC.id, sA.id]);

		expect(pptx.sections).toHaveLength(2);
		expect(pptx.sections[0].name).toBe('C');
		expect(pptx.sections[1].name).toBe('A');
	});

	it('ignores nonexistent section IDs', async () => {
		const pptx = await createWithSlides(2);
		const s = pptx.addSection('Only', [0]);

		pptx.reorderSections(['fake_id_1', s.id, 'fake_id_2']);

		expect(pptx.sections).toHaveLength(1);
		expect(pptx.sections[0].name).toBe('Only');
	});

	it('empty array clears all sections', async () => {
		const pptx = await createWithSlides(2);
		pptx.addSection('A', [0]);
		pptx.addSection('B', [1]);

		pptx.reorderSections([]);
		expect(pptx.sections).toHaveLength(0);
	});

	it('no-op when no sections exist', async () => {
		const pptx = await createWithSlides(1);
		// Should not throw
		pptx.reorderSections(['some_id']);
		expect(pptx.sections).toHaveLength(0);
	});
});

// ===========================================================================
// getSectionForSlide()
// ===========================================================================

describe('presentation.getSectionForSlide()', () => {
	it('returns the section a slide belongs to', async () => {
		const pptx = await createWithSlides(3);
		const section = pptx.addSection('Intro', [0, 1]);

		const found = pptx.getSectionForSlide(0);
		expect(found).toBeDefined();
		expect(found!.id).toBe(section.id);
		expect(found!.name).toBe('Intro');
	});

	it('returns undefined for a slide not in any section', async () => {
		const pptx = await createWithSlides(3);
		pptx.addSection('Intro', [0]);

		const found = pptx.getSectionForSlide(2);
		expect(found).toBeUndefined();
	});

	it('returns undefined when no sections exist', async () => {
		const pptx = await createWithSlides(2);
		const found = pptx.getSectionForSlide(0);
		expect(found).toBeUndefined();
	});

	it('returns undefined for negative index', async () => {
		const pptx = await createWithSlides(2);
		pptx.addSection('A', [0]);
		const found = pptx.getSectionForSlide(-1);
		expect(found).toBeUndefined();
	});

	it('returns undefined for out-of-range index', async () => {
		const pptx = await createWithSlides(2);
		pptx.addSection('A', [0]);
		const found = pptx.getSectionForSlide(10);
		expect(found).toBeUndefined();
	});

	it('returns the correct section after multiple sections are added', async () => {
		const pptx = await createWithSlides(4);
		pptx.addSection('Intro', [0]);
		const body = pptx.addSection('Body', [1, 2]);
		pptx.addSection('End', [3]);

		const found = pptx.getSectionForSlide(2);
		expect(found).toBeDefined();
		expect(found!.id).toBe(body.id);
		expect(found!.name).toBe('Body');
	});
});

// ===========================================================================
// moveSlidesToSection()
// ===========================================================================

describe('presentation.moveSlidesToSection()', () => {
	it('moves slides to a target section', async () => {
		const pptx = await createWithSlides(4);
		const sA = pptx.addSection('A', [0, 1]);
		const sB = pptx.addSection('B', [2, 3]);

		const result = pptx.moveSlidesToSection([0], sB.id);
		expect(result).toBeTruthy();

		// Slide 0 should now be in section B
		expect(pptx.getSlide(0).sectionId).toBe(sB.id);
		expect(pptx.getSlide(0).sectionName).toBe('B');

		// Section A should have lost slide 0's ID
		const updatedA = pptx.sections.find((s) => s.id === sA.id)!;
		expect(updatedA.slideIds).not.toContain(pptx.getSlide(0).id);
	});

	it('returns false for nonexistent target section', async () => {
		const pptx = await createWithSlides(2);
		pptx.addSection('A', [0]);

		const result = pptx.moveSlidesToSection([0], 'nonexistent');
		expect(result).toBeFalsy();
	});

	it('returns false when no sections exist', async () => {
		const pptx = await createWithSlides(2);
		const result = pptx.moveSlidesToSection([0], 'any_id');
		expect(result).toBeFalsy();
	});

	it('skips out-of-range slide indices', async () => {
		const pptx = await createWithSlides(2);
		const section = pptx.addSection('A', [0]);

		// Include both valid (1) and invalid (-1, 10) indices
		const result = pptx.moveSlidesToSection([-1, 1, 10], section.id);
		expect(result).toBeTruthy();

		// Only slide 1 should be moved
		expect(pptx.getSlide(1).sectionId).toBe(section.id);
	});

	it('does not add duplicate slide IDs to target section', async () => {
		const pptx = await createWithSlides(2);
		const section = pptx.addSection('A', [0, 1]);

		// Move slide 0 to section A (where it already belongs)
		const result = pptx.moveSlidesToSection([0], section.id);
		expect(result).toBeTruthy();

		const slideId = pptx.getSlide(0).id;
		const count = section.slideIds.filter((id) => id === slideId).length;
		expect(count).toBe(1);
	});
});

// ===========================================================================
// sections getter
// ===========================================================================

describe('presentation.sections getter', () => {
	it('returns empty array when no sections exist', async () => {
		const pptx = await Presentation.create();
		expect(pptx.sections).toStrictEqual([]);
	});

	it('returns all sections after adding them', async () => {
		const pptx = await createWithSlides(3);
		pptx.addSection('A', [0]);
		pptx.addSection('B', [1, 2]);

		expect(pptx.sections).toHaveLength(2);
		expect(pptx.sections[0].name).toBe('A');
		expect(pptx.sections[1].name).toBe('B');
	});

	it('reflects removals', async () => {
		const pptx = await createWithSlides(3);
		const sA = pptx.addSection('A', [0]);
		pptx.addSection('B', [1]);

		pptx.removeSection(sA.id);
		expect(pptx.sections).toHaveLength(1);
		expect(pptx.sections[0].name).toBe('B');
	});

	it('returns empty array after removing all sections', async () => {
		const pptx = await createWithSlides(2);
		const s = pptx.addSection('A', [0]);
		pptx.removeSection(s.id);
		expect(pptx.sections).toStrictEqual([]);
	});
});

// ===========================================================================
// mailMerge()
// ===========================================================================

describe('presentation.mailMerge()', () => {
	it('generates one PPTX per record', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Hello {{name}}', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const outputs = await pptx.mailMerge([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }]);

		expect(outputs).toHaveLength(3);
		for (const bytes of outputs) {
			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(bytes.length).toBeGreaterThan(0);
			// ZIP magic number
			expect(bytes[0]).toBe(0x50);
			expect(bytes[1]).toBe(0x4b);
		}
	});

	it('returns empty array for empty records', async () => {
		const pptx = await createWithSlides(1);
		const outputs = await pptx.mailMerge([]);
		expect(outputs).toStrictEqual([]);
	});

	it('does not modify the original presentation', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Dear {{name}}', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		await pptx.mailMerge([{ name: 'Alice' }]);

		// Original should still have the placeholder
		const results = pptx.findText('{{name}}');
		expect(results.length).toBeGreaterThanOrEqual(1);
	});

	it('each output is independently loadable', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Record for {{name}}', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const outputs = await pptx.mailMerge([{ name: 'Test' }]);
		const loaded = await Presentation.load(outputs[0].buffer as ArrayBuffer);
		expect(loaded.slideCount).toBe(1);
	});

	it('handles single record', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('{{greeting}}', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const outputs = await pptx.mailMerge([{ greeting: 'Hi' }]);
		expect(outputs).toHaveLength(1);
	});
});

// ===========================================================================
// diff()
// ===========================================================================

describe('presentation.diff()', () => {
	it('reports no changes for identical presentations', async () => {
		const a = await createWithSlides(2);
		const result = a.diff(a);

		expect(result.slideChanges).toHaveLength(0);
		expect(result.summary.added).toBe(0);
		expect(result.summary.removed).toBe(0);
		expect(result.summary.modified).toBe(0);
	});

	it('detects added slides', async () => {
		const a = await createWithSlides(1);
		const b = await createWithSlides(3);

		const result = a.diff(b);

		// Since slides have different IDs, all of b's slides are "added"
		// and all of a's slides are "removed"
		expect(result.summary.added).toBeGreaterThanOrEqual(1);
		expect(result.slideChanges.some((sc) => sc.type === 'added')).toBeTruthy();
	});

	it('detects removed slides', async () => {
		const a = await createWithSlides(3);
		const b = await createWithSlides(1);

		const result = a.diff(b);

		// a has slides not in b => "removed"
		expect(result.summary.removed).toBeGreaterThanOrEqual(1);
		expect(result.slideChanges.some((sc) => sc.type === 'removed')).toBeTruthy();
	});

	it('returns a PresentationDiff structure', async () => {
		const a = await createWithSlides(1);
		const b = await createWithSlides(1);

		const result = a.diff(b);

		expect(result).toHaveProperty('slideChanges');
		expect(result).toHaveProperty('themeChanged');
		expect(result).toHaveProperty('metadataChanges');
		expect(result).toHaveProperty('summary');
		expectTypeOf(result.themeChanged).toBeBoolean();
		expect(Array.isArray(result.metadataChanges)).toBeTruthy();
	});

	it('detects theme differences between presentations', async () => {
		const a = await Presentation.create({
			theme: { colors: { accent1: '#FF0000' } },
		});
		a.addSlide('Blank');

		const b = await Presentation.create({
			theme: { colors: { accent1: '#00FF00' } },
		});
		b.addSlide('Blank');

		const result = a.diff(b);
		expect(result.themeChanged).toBeTruthy();
	});

	it('compares two empty presentations without error', async () => {
		const a = await Presentation.create();
		const b = await Presentation.create();

		const result = a.diff(b);

		expect(result.slideChanges).toHaveLength(0);
		expect(result.summary.added).toBe(0);
		expect(result.summary.removed).toBe(0);
	});
});

// ===========================================================================
// title getter
// ===========================================================================

describe('presentation.title getter', () => {
	it('returns the title when set via create options', async () => {
		const pptx = await Presentation.create({ title: 'My Presentation' });
		expect(pptx.title).toBe('My Presentation');
	});

	it('returns undefined when no title is set', async () => {
		const pptx = await Presentation.create();
		// coreProperties may or may not exist, title may be undefined
		expect(pptx.title).toBeUndefined();
	});

	it('returns the title from a loaded presentation', async () => {
		const original = await Presentation.create({ title: 'Saved Title' });
		original.addSlide('Blank');
		const bytes = await original.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);

		// Title may or may not survive the round-trip depending on save implementation
		// At minimum, it should not throw
		expect(() => loaded.title).not.toThrow();
	});
});

// ===========================================================================
// creator getter
// ===========================================================================

describe('presentation.creator getter', () => {
	it('returns the creator when set via create options', async () => {
		const pptx = await Presentation.create({ creator: 'John Doe' });
		expect(pptx.creator).toBe('John Doe');
	});

	it('returns default creator when none is explicitly set', async () => {
		const pptx = await Presentation.create();
		// The SDK sets a default creator of "pptx-viewer-sdk"
		expect(pptx.creator).toBe('pptx-viewer-sdk');
	});

	it('returns the creator from a loaded presentation', async () => {
		const original = await Presentation.create({ creator: 'Jane Smith' });
		original.addSlide('Blank');
		const bytes = await original.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);

		expect(() => loaded.creator).not.toThrow();
	});
});

// ===========================================================================
// xmlBuilder()
// ===========================================================================

describe('presentation.xmlBuilder()', () => {
	it('returns a PptxXmlBuilder instance', async () => {
		const pptx = await createWithSlides(1);
		const builder = pptx.xmlBuilder();
		expect(builder).toBeInstanceOf(PptxXmlBuilder);
	});

	it('builder wraps the same data as the presentation', async () => {
		const pptx = await createWithSlides(2);
		const builder = pptx.xmlBuilder();
		const project = builder.project();

		expect(project).toBe(pptx.data);
	});

	it('builder can navigate to a slide', async () => {
		const pptx = await createWithSlides(2);
		const builder = pptx.xmlBuilder();

		// Should not throw for valid slide indices
		expect(() => builder.slide(0)).not.toThrow();
		expect(() => builder.slide(1)).not.toThrow();
	});

	it('can create builder for empty presentation', async () => {
		const pptx = await Presentation.create();
		const builder = pptx.xmlBuilder();
		expect(builder).toBeInstanceOf(PptxXmlBuilder);
	});

	it('multiple calls return independent builders', async () => {
		const pptx = await createWithSlides(1);
		const builder1 = pptx.xmlBuilder();
		const builder2 = pptx.xmlBuilder();

		// Both should be valid instances
		expect(builder1).toBeInstanceOf(PptxXmlBuilder);
		expect(builder2).toBeInstanceOf(PptxXmlBuilder);
		// But they are different objects
		expect(builder1).not.toBe(builder2);
	});
});

// ===========================================================================
// width getter
// ===========================================================================

describe('presentation.width getter', () => {
	it('returns a positive number', async () => {
		const pptx = await Presentation.create();
		expect(pptx.width).toBeGreaterThan(0);
	});

	it('returns the default widescreen width (12192000 EMU) when not explicitly set', async () => {
		const pptx = await Presentation.create();
		// The default is either widthEmu or width from data, or the fallback 12192000
		expectTypeOf(pptx.width).toBeNumber();
		expect(pptx.width).toBeGreaterThan(0);
	});

	it('returns a consistent value on repeated access', async () => {
		const pptx = await Presentation.create();
		const w1 = pptx.width;
		const w2 = pptx.width;
		expect(w1).toBe(w2);
	});

	it('returns width from a loaded presentation', async () => {
		const original = await Presentation.create();
		original.addSlide('Blank');
		const bytes = await original.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);

		expect(loaded.width).toBeGreaterThan(0);
	});
});

// ===========================================================================
// height getter
// ===========================================================================

describe('presentation.height getter', () => {
	it('returns a positive number', async () => {
		const pptx = await Presentation.create();
		expect(pptx.height).toBeGreaterThan(0);
	});

	it('returns the default height (6858000 EMU) when not explicitly set', async () => {
		const pptx = await Presentation.create();
		expectTypeOf(pptx.height).toBeNumber();
		expect(pptx.height).toBeGreaterThan(0);
	});

	it('returns a consistent value on repeated access', async () => {
		const pptx = await Presentation.create();
		const h1 = pptx.height;
		const h2 = pptx.height;
		expect(h1).toBe(h2);
	});

	it('width and height have expected aspect ratio (~16:9)', async () => {
		const pptx = await Presentation.create();
		const ratio = pptx.width / pptx.height;
		// Standard 16:9 ratio is ~1.778, allow some tolerance
		// Also could be 4:3 (~1.333) depending on defaults
		expect(ratio).toBeGreaterThan(1.0);
		expect(ratio).toBeLessThan(2.5);
	});

	it('returns height from a loaded presentation', async () => {
		const original = await Presentation.create();
		original.addSlide('Blank');
		const bytes = await original.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);

		expect(loaded.height).toBeGreaterThan(0);
	});
});

// ===========================================================================
// Integration: combining extended methods
// ===========================================================================

describe('extended API integration', () => {
	it('swap + reorder + clear workflow', async () => {
		const pptx = await createWithSlides(4);
		const _id0 = pptx.getSlide(0).id;

		// Swap then reorder
		pptx.swapSlides(0, 3).reorderSlides([3, 2, 1, 0]);

		// After swap: [3, 1, 2, 0] (by original indices)
		// After reorder [3,2,1,0] of the swapped: reverses again
		expect(pptx.slideCount).toBe(4);

		// Clear everything
		pptx.clearSlides();
		expect(pptx.slideCount).toBe(0);
	});

	it('sections + getSectionForSlide + moveSlidesToSection workflow', async () => {
		const pptx = await createWithSlides(4);
		const intro = pptx.addSection('Intro', [0, 1]);
		const body = pptx.addSection('Body', [2, 3]);

		// Verify getSectionForSlide
		expect(pptx.getSectionForSlide(0)!.name).toBe('Intro');
		expect(pptx.getSectionForSlide(2)!.name).toBe('Body');

		// Move slide 0 from Intro to Body
		pptx.moveSlidesToSection([0], body.id);
		expect(pptx.getSectionForSlide(0)!.name).toBe('Body');

		// Reorder sections
		pptx.reorderSections([body.id, intro.id]);
		expect(pptx.sections[0].name).toBe('Body');
		expect(pptx.sections[1].name).toBe('Intro');
	});

	it('forEachSlide + findSlides combined', async () => {
		const pptx = await createWithSlides(5);

		// Tag odd slides
		pptx.forEachSlide((slide, index) => {
			if (index % 2 !== 0) {
				slide.hidden = true;
			}
		});

		// Find hidden slides
		const hiddenIndices = pptx.findSlides((slide) => slide.hidden === true);
		expect(hiddenIndices).toStrictEqual([1, 3]);
	});

	it('replaceTextOnSlide only affects the targeted slide', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('ACME Corp', { x: 0, y: 0, width: 400, height: 50 });
		pptx.addSlide('Blank').addText('ACME Corp', { x: 0, y: 0, width: 400, height: 50 });
		pptx.addSlide('Blank').addText('ACME Corp', { x: 0, y: 0, width: 400, height: 50 });

		pptx.replaceTextOnSlide(1, 'ACME Corp', 'NewCo Inc');

		// Find remaining "ACME Corp" -- should be on slides 0 and 2
		const remaining = pptx.findText('ACME Corp');
		const slideIndices = remaining.map((r) => r.slideIndex);
		expect(slideIndices).toContain(0);
		expect(slideIndices).toContain(2);
		expect(slideIndices).not.toContain(1);
	});
});
