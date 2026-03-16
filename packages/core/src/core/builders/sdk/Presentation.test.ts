/**
 * Comprehensive tests for the Presentation class (top-level fluent SDK API).
 *
 * Tests cover:
 * - Static create() and load() factory methods
 * - Slide management: addSlide, insertSlide, duplicateSlide, removeSlide, moveSlide
 * - slideCount getter and getSlide method
 * - Text operations: findText, replaceText
 * - Section operations: addSection, removeSection
 * - Merge operations
 * - Template application
 * - Save / round-trip
 * - dispose() cleanup
 * - handler, data, slides getters
 */

import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import { Presentation } from './Presentation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a presentation with a few text slides for reuse in tests. */
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
// 1. Static create() method
// ===========================================================================

describe('presentation.create()', () => {
	it('creates a presentation with no options', async () => {
		const pptx = await Presentation.create();
		expect(pptx).toBeInstanceOf(Presentation);
		expect(pptx.slideCount).toBe(0);
		expect(pptx.data).toBeDefined();
		expect(pptx.handler).toBeInstanceOf(PptxHandler);
	});

	it('creates a presentation with title and creator', async () => {
		const pptx = await Presentation.create({
			title: 'Test Title',
			creator: 'Test Author',
		});
		expect(pptx.slideCount).toBe(0);
		// Verify metadata through save + ZIP inspection is possible,
		// but at minimum the presentation should be valid
		const bytes = await pptx.save();
		expect(bytes.length).toBeGreaterThan(0);
	});

	it('creates a presentation with custom theme colors', async () => {
		const pptx = await Presentation.create({
			theme: {
				name: 'Custom',
				colors: {
					accent1: '#FF6B6B',
					accent2: '#556270',
				},
			},
		});
		expect(pptx.data.themeColorMap).toBeDefined();
		if (pptx.data.themeColorMap) {
			expect(pptx.data.themeColorMap.accent1?.toUpperCase()).toBe('#FF6B6B');
		}
	});

	it('creates a presentation with custom fonts', async () => {
		const pptx = await Presentation.create({
			theme: {
				fonts: { majorFont: 'Inter', minorFont: 'Roboto' },
			},
		});
		expect(pptx.data.theme?.fontScheme).toBeDefined();
	});

	it('creates a presentation with initialSlideCount', async () => {
		const pptx = await Presentation.create({ initialSlideCount: 3 });
		expect(pptx.slideCount).toBe(3);
		for (let i = 0; i < 3; i++) {
			expect(pptx.getSlide(i).slideNumber).toBe(i + 1);
		}
	});

	it('initialSlideCount 0 produces no slides', async () => {
		const pptx = await Presentation.create({ initialSlideCount: 0 });
		expect(pptx.slideCount).toBe(0);
	});

	it('negative initialSlideCount treated as 0', async () => {
		const pptx = await Presentation.create({ initialSlideCount: -2 });
		expect(pptx.slideCount).toBe(0);
	});
});

// ===========================================================================
// 2. Static load() method
// ===========================================================================

describe('presentation.load()', () => {
	it('loads a presentation from bytes (round-trip)', async () => {
		const original = await Presentation.create({ title: 'Load Test' });
		original.addSlide('Blank').addText('Hello', {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 400,
			height: 50,
		});
		original.addSlide('Blank').addText('World', {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 400,
			height: 50,
		});

		const bytes = await original.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);

		expect(loaded).toBeInstanceOf(Presentation);
		expect(loaded.slideCount).toBe(2);
		expect(loaded.handler).toBeInstanceOf(PptxHandler);
		expect(loaded.data.slides).toHaveLength(2);
	});

	it('loaded presentation can add new slides', async () => {
		const original = await Presentation.create();
		original.addSlide('Blank');
		const bytes = await original.save();

		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);
		expect(loaded.slideCount).toBe(1);

		loaded.addSlide();
		expect(loaded.slideCount).toBe(2);
	});
});

// ===========================================================================
// 3. addSlide() method
// ===========================================================================

describe('presentation.addSlide()', () => {
	it('adds a blank slide with default layout', async () => {
		const pptx = await Presentation.create();
		const builder = pptx.addSlide();
		expect(pptx.slideCount).toBe(1);
		// Builder should be defined (SlideBuilder returned)
		expect(builder).toBeDefined();
	});

	it('adds a slide with specific layout name', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Title Slide');
		expect(pptx.slideCount).toBe(1);
		expect(pptx.getSlide(0).layoutName).toBe('Title Slide');
	});

	it('returns a SlideBuilder that can chain element additions', async () => {
		const pptx = await Presentation.create();
		const builder = pptx
			.addSlide('Blank')
			.addText('Title', { fontSize: 36, x: 50, y: 50, width: 800, height: 60 })
			.addShape('rect', {
				fill: { type: 'solid', color: '#FF0000' },
				x: 100,
				y: 200,
				width: 300,
				height: 200,
			});
		// Chainable -- builder is returned from each call
		expect(builder).toBeDefined();
	});

	it('elements added through builder appear in the slide', async () => {
		const pptx = await Presentation.create();
		pptx
			.addSlide('Blank')
			.addText('Hello', { fontSize: 24, x: 100, y: 100, width: 400, height: 50 })
			.addShape('ellipse', { x: 200, y: 200, width: 100, height: 100 });

		const slide = pptx.getSlide(0);
		expect(slide.elements).toHaveLength(2);
		expect(slide.elements[0].type).toBe('text');
		expect(slide.elements[1].type).toBe('shape');
	});

	it('multiple slides can be added', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank');
		pptx.addSlide('Title Slide');
		pptx.addSlide('Blank');
		expect(pptx.slideCount).toBe(3);
	});

	it('the slide is automatically in the data.slides array', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Auto-tracked', {
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		});
		// No manual push needed -- slides array is updated internally
		expect(pptx.data.slides).toHaveLength(1);
		expect(pptx.slides).toHaveLength(1);
		expect(pptx.slides[0].elements).toHaveLength(1);
	});
});

// ===========================================================================
// 4. insertSlide() method
// ===========================================================================

describe('presentation.insertSlide()', () => {
	it('inserts at beginning (index 0)', async () => {
		const pptx = await createWithSlides(2);
		pptx.insertSlide(0, 'Title Slide').addText('Inserted at 0', {
			x: 0,
			y: 0,
			width: 300,
			height: 50,
		});

		expect(pptx.slideCount).toBe(3);
		expect(pptx.getSlide(0).layoutName).toBe('Title Slide');
		// Original first slide is now at index 1
		expect(pptx.getSlide(0).slideNumber).toBe(1);
		expect(pptx.getSlide(1).slideNumber).toBe(2);
		expect(pptx.getSlide(2).slideNumber).toBe(3);
	});

	it('inserts at a specific position', async () => {
		const pptx = await createWithSlides(3);
		pptx.insertSlide(1, 'Title Slide').addText('Inserted at 1', {
			x: 0,
			y: 0,
			width: 300,
			height: 50,
		});

		expect(pptx.slideCount).toBe(4);
		expect(pptx.getSlide(1).layoutName).toBe('Title Slide');
	});

	it('clamps negative index to 0', async () => {
		const pptx = await createWithSlides(2);
		pptx.insertSlide(-5, 'Blank');
		expect(pptx.slideCount).toBe(3);
		// Should be inserted at position 0
		expect(pptx.getSlide(0).slideNumber).toBe(1);
	});

	it('clamps out-of-range positive index to end', async () => {
		const pptx = await createWithSlides(2);
		pptx.insertSlide(100, 'Blank');
		expect(pptx.slideCount).toBe(3);
		// Inserted at the end
		expect(pptx.getSlide(2).slideNumber).toBe(3);
	});

	it('renumbers slides after insertion', async () => {
		const pptx = await createWithSlides(3);
		pptx.insertSlide(1, 'Blank');

		for (let i = 0; i < pptx.slideCount; i++) {
			expect(pptx.getSlide(i).slideNumber).toBe(i + 1);
		}
	});
});

// ===========================================================================
// 5. duplicateSlide() method
// ===========================================================================

describe('presentation.duplicateSlide()', () => {
	it('duplicates a slide', async () => {
		const pptx = await createWithSlides(2);
		const originalElements = pptx.getSlide(0).elements.length;

		const newIndex = pptx.duplicateSlide(0);

		expect(newIndex).toBe(2);
		expect(pptx.slideCount).toBe(3);
		expect(pptx.getSlide(newIndex).elements).toHaveLength(originalElements);
	});

	it('throws RangeError for negative index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.duplicateSlide(-1)).toThrow(RangeError);
	});

	it('throws RangeError for out-of-range index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.duplicateSlide(5)).toThrow(RangeError);
	});

	it('throws RangeError when there are no slides', async () => {
		const pptx = await Presentation.create();
		expect(() => pptx.duplicateSlide(0)).toThrow(RangeError);
	});

	it("returns the new slide's index", async () => {
		const pptx = await createWithSlides(3);
		const idx = pptx.duplicateSlide(1);
		expect(idx).toBe(3); // appended to end
	});

	it('the duplicated slide has different IDs from the original', async () => {
		const pptx = await createWithSlides(1);
		pptx.duplicateSlide(0);

		const original = pptx.getSlide(0);
		const clone = pptx.getSlide(1);

		expect(clone.id).not.toBe(original.id);
		expect(clone.rId).not.toBe(original.rId);

		// Element IDs should also differ
		if (original.elements.length > 0 && clone.elements.length > 0) {
			expect(clone.elements[0].id).not.toBe(original.elements[0].id);
		}
	});
});

// ===========================================================================
// 6. removeSlide() method
// ===========================================================================

describe('presentation.removeSlide()', () => {
	it('removes a slide by index', async () => {
		const pptx = await createWithSlides(3);
		pptx.removeSlide(1);
		expect(pptx.slideCount).toBe(2);
	});

	it('throws RangeError for negative index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.removeSlide(-1)).toThrow(RangeError);
	});

	it('throws RangeError for out-of-range index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.removeSlide(5)).toThrow(RangeError);
	});

	it('throws RangeError on empty presentation', async () => {
		const pptx = await Presentation.create();
		expect(() => pptx.removeSlide(0)).toThrow(RangeError);
	});

	it('renumbers remaining slides', async () => {
		const pptx = await createWithSlides(3);
		pptx.removeSlide(0);

		expect(pptx.slideCount).toBe(2);
		expect(pptx.getSlide(0).slideNumber).toBe(1);
		expect(pptx.getSlide(1).slideNumber).toBe(2);
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(3);
		const result = pptx.removeSlide(2);
		expect(result).toBe(pptx);
	});

	it('supports chained removal', async () => {
		const pptx = await createWithSlides(3);
		pptx.removeSlide(2).removeSlide(1);
		expect(pptx.slideCount).toBe(1);
	});
});

// ===========================================================================
// 7. moveSlide() method
// ===========================================================================

describe('presentation.moveSlide()', () => {
	it('moves a slide forward', async () => {
		const pptx = await createWithSlides(3);
		const firstSlideId = pptx.getSlide(0).id;
		pptx.moveSlide(0, 2);

		// The slide that was at index 0 is now at index 2
		expect(pptx.getSlide(2).id).toBe(firstSlideId);
	});

	it('moves a slide backward', async () => {
		const pptx = await createWithSlides(3);
		const lastSlideId = pptx.getSlide(2).id;
		pptx.moveSlide(2, 0);

		expect(pptx.getSlide(0).id).toBe(lastSlideId);
	});

	it('renumbers slides after move', async () => {
		const pptx = await createWithSlides(3);
		pptx.moveSlide(2, 0);

		for (let i = 0; i < pptx.slideCount; i++) {
			expect(pptx.getSlide(i).slideNumber).toBe(i + 1);
		}
	});

	it('throws RangeError for invalid fromIndex', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.moveSlide(-1, 0)).toThrow(RangeError);
		expect(() => pptx.moveSlide(5, 0)).toThrow(RangeError);
	});

	it('throws RangeError for invalid toIndex', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.moveSlide(0, -1)).toThrow(RangeError);
		expect(() => pptx.moveSlide(0, 5)).toThrow(RangeError);
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(3);
		const result = pptx.moveSlide(0, 1);
		expect(result).toBe(pptx);
	});

	it('moving a slide to its own position is a no-op', async () => {
		const pptx = await createWithSlides(3);
		const slideId = pptx.getSlide(1).id;
		pptx.moveSlide(1, 1);
		expect(pptx.getSlide(1).id).toBe(slideId);
	});
});

// ===========================================================================
// 8. slideCount getter
// ===========================================================================

describe('presentation.slideCount', () => {
	it('returns 0 for empty presentation', async () => {
		const pptx = await Presentation.create();
		expect(pptx.slideCount).toBe(0);
	});

	it('returns correct count after adding slides', async () => {
		const pptx = await createWithSlides(5);
		expect(pptx.slideCount).toBe(5);
	});

	it('updates after removing slides', async () => {
		const pptx = await createWithSlides(3);
		pptx.removeSlide(0);
		expect(pptx.slideCount).toBe(2);
	});

	it('updates after duplicating slides', async () => {
		const pptx = await createWithSlides(2);
		pptx.duplicateSlide(0);
		expect(pptx.slideCount).toBe(3);
	});
});

// ===========================================================================
// 9. getSlide() method
// ===========================================================================

describe('presentation.getSlide()', () => {
	it('returns the slide at the given index', async () => {
		const pptx = await createWithSlides(3);
		const slide = pptx.getSlide(1);
		expect(slide).toBeDefined();
		expect(slide.slideNumber).toBe(2);
	});

	it('throws RangeError for negative index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.getSlide(-1)).toThrow(RangeError);
	});

	it('throws RangeError for out-of-range index', async () => {
		const pptx = await createWithSlides(2);
		expect(() => pptx.getSlide(5)).toThrow(RangeError);
	});

	it('returns a live reference (mutations are reflected)', async () => {
		const pptx = await createWithSlides(1);
		const slide = pptx.getSlide(0);
		slide.notes = 'Added notes';
		expect(pptx.getSlide(0).notes).toBe('Added notes');
	});
});

// ===========================================================================
// 10. findText() and replaceText()
// ===========================================================================

describe('presentation.findText()', () => {
	it('finds text added via builder', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Hello World', {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 400,
			height: 50,
		});

		const results = pptx.findText('Hello');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0].text).toBe('Hello');
		expect(results[0].slideIndex).toBe(0);
	});

	it('finds text across multiple slides', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Hello from slide 1', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});
		pptx.addSlide('Blank').addText('Hello from slide 2', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const results = pptx.findText('Hello');
		expect(results.length).toBeGreaterThanOrEqual(2);
	});

	it('returns empty array when text is not found', async () => {
		const pptx = await createWithSlides(2);
		const results = pptx.findText('nonexistent');
		expect(results).toHaveLength(0);
	});

	it('supports regex search', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Q1 2025', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});
		pptx.addSlide('Blank').addText('Q3 2026', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const results = pptx.findText(/Q[1-4] \d{4}/);
		expect(results.length).toBeGreaterThanOrEqual(2);
	});
});

describe('presentation.replaceText()', () => {
	it('replaces text across slides', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Hello World', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});
		pptx.addSlide('Blank').addText('Hello Everyone', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const count = pptx.replaceText('Hello', 'Hi');
		expect(count).toBeGreaterThanOrEqual(2);

		// Verify replacement happened
		const remaining = pptx.findText('Hello');
		expect(remaining).toHaveLength(0);
	});

	it('returns 0 when nothing to replace', async () => {
		const pptx = await createWithSlides(1);
		const count = pptx.replaceText('nonexistent', 'replacement');
		expect(count).toBe(0);
	});

	it('supports regex replacement', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('2025', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const count = pptx.replaceText(/(\d{4})/, 'Year: $1');
		expect(count).toBeGreaterThanOrEqual(1);
	});
});

// ===========================================================================
// 11. addSection() and removeSection()
// ===========================================================================

describe('presentation.addSection()', () => {
	it('adds a section to the presentation', async () => {
		const pptx = await createWithSlides(3);
		const section = pptx.addSection('Introduction', [0, 1]);

		expect(section).toBeDefined();
		expect(section.name).toBe('Introduction');
		expect(section.id).toBeDefined();
		expect(section.slideIds).toHaveLength(2);
	});

	it('updates slide section references', async () => {
		const pptx = await createWithSlides(3);
		const section = pptx.addSection('Body', [1, 2]);

		expect(pptx.getSlide(1).sectionName).toBe('Body');
		expect(pptx.getSlide(1).sectionId).toBe(section.id);
		expect(pptx.getSlide(2).sectionName).toBe('Body');
		// First slide should not be in the section
		expect(pptx.getSlide(0).sectionName).toBeUndefined();
	});

	it('creates sections array if it does not exist', async () => {
		const pptx = await createWithSlides(1);
		pptx.addSection('Test', [0]);
		expect(pptx.data.sections).toBeDefined();
		expect(pptx.data.sections!).toHaveLength(1);
	});
});

describe('presentation.removeSection()', () => {
	it('removes a section by ID', async () => {
		const pptx = await createWithSlides(3);
		const section = pptx.addSection('Introduction', [0, 1]);

		const removed = pptx.removeSection(section.id);
		expect(removed).toBeTruthy();
		expect(pptx.data.sections!).toHaveLength(0);
	});

	it('clears section references on slides', async () => {
		const pptx = await createWithSlides(3);
		const section = pptx.addSection('Introduction', [0, 1]);

		pptx.removeSection(section.id);
		expect(pptx.getSlide(0).sectionName).toBeUndefined();
		expect(pptx.getSlide(0).sectionId).toBeUndefined();
		expect(pptx.getSlide(1).sectionName).toBeUndefined();
	});

	it('returns false for nonexistent section ID', async () => {
		const pptx = await createWithSlides(1);
		const removed = pptx.removeSection('nonexistent');
		expect(removed).toBeFalsy();
	});

	it('returns false when no sections exist', async () => {
		const pptx = await createWithSlides(1);
		const removed = pptx.removeSection('any_id');
		expect(removed).toBeFalsy();
	});
});

// ===========================================================================
// 12. merge() method
// ===========================================================================

describe('presentation.merge()', () => {
	it('merges two presentations created from scratch', async () => {
		const target = await Presentation.create();
		target.addSlide('Blank').addText('Target slide 1', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const source = await Presentation.create();
		source.addSlide('Blank').addText('Source slide 1', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});
		source.addSlide('Blank').addText('Source slide 2', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const count = target.merge(source);
		expect(count).toBe(2);
		expect(target.slideCount).toBe(3);
	});

	it('merges with insertAt option', async () => {
		const target = await createWithSlides(2);
		const source = await createWithSlides(1);

		target.merge(source, { insertAt: 0 });
		expect(target.slideCount).toBe(3);
	});

	it('merges specific slides with slideIndices option', async () => {
		const target = await createWithSlides(1);
		const source = await createWithSlides(3);

		const count = target.merge(source, { slideIndices: [0, 2] });
		expect(count).toBe(2);
		expect(target.slideCount).toBe(3);
	});

	it('returns 0 when source has no slides', async () => {
		const target = await createWithSlides(1);
		const source = await Presentation.create();

		const count = target.merge(source);
		expect(count).toBe(0);
		expect(target.slideCount).toBe(1);
	});

	it('merged slides have unique IDs', async () => {
		const target = await createWithSlides(1);
		const source = await createWithSlides(1);

		target.merge(source);
		expect(target.slideCount).toBe(2);

		const ids = target.slides.map((s) => s.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});
});

// ===========================================================================
// 13. applyTemplate()
// ===========================================================================

describe('presentation.applyTemplate()', () => {
	it('applies template data to slides', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Hello {{name}}', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const result = pptx.applyTemplate({ name: 'Alice' });

		// Should return this for chaining
		expect(result).toBe(pptx);

		// Verify the text was replaced
		const found = pptx.findText('Alice');
		expect(found.length).toBeGreaterThanOrEqual(1);

		// The placeholder should be gone
		const remaining = pptx.findText('{{name}}');
		expect(remaining).toHaveLength(0);
	});

	it('returns this for chaining', async () => {
		const pptx = await createWithSlides(1);
		const result = pptx.applyTemplate({ key: 'value' });
		expect(result).toBe(pptx);
	});
});

// ===========================================================================
// 14. save() method
// ===========================================================================

describe('presentation.save()', () => {
	it('saves to Uint8Array', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Test', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});

		const bytes = await pptx.save();
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it('saved bytes start with ZIP magic number', async () => {
		const pptx = await Presentation.create();
		const bytes = await pptx.save();

		// ZIP magic number: PK (0x50 0x4B)
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);
	});

	it('saved bytes can be reloaded', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Round trip', {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 400,
			height: 50,
		});
		pptx.addSlide('Title Slide').addText('Title', {
			fontSize: 44,
			bold: true,
			x: 100,
			y: 200,
			width: 800,
			height: 80,
		});

		const bytes = await pptx.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);

		expect(loaded.slideCount).toBe(2);
		expect(loaded.data.slides).toHaveLength(2);
	});

	it('can be saved multiple times', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank');

		const bytes1 = await pptx.save();
		const bytes2 = await pptx.save();

		expect(bytes1.length).toBeGreaterThan(0);
		expect(bytes2.length).toBeGreaterThan(0);
	});

	it('empty presentation can be saved', async () => {
		const pptx = await Presentation.create();
		const bytes = await pptx.save();
		expect(bytes.length).toBeGreaterThan(0);
	});
});

// ===========================================================================
// 15. dispose() method
// ===========================================================================

describe('presentation.dispose()', () => {
	it('does not throw when called', async () => {
		const pptx = await Presentation.create();
		expect(() => pptx.dispose()).not.toThrow();
	});

	it('can be called on a presentation with slides', async () => {
		const pptx = await createWithSlides(3);
		expect(() => pptx.dispose()).not.toThrow();
	});
});

// ===========================================================================
// 16. handler, data, slides getters
// ===========================================================================

describe('presentation getters', () => {
	it('handler returns a PptxHandler instance', async () => {
		const pptx = await Presentation.create();
		expect(pptx.handler).toBeInstanceOf(PptxHandler);
	});

	it('data returns the PptxData object', async () => {
		const pptx = await Presentation.create();
		expect(pptx.data).toBeDefined();
		expect(pptx.data.slides).toBeDefined();
		expect(Array.isArray(pptx.data.slides)).toBeTruthy();
	});

	it('slides returns a live reference to the slides array', async () => {
		const pptx = await createWithSlides(2);
		const slides = pptx.slides;
		expect(slides).toHaveLength(2);

		// It is a live reference
		pptx.addSlide('Blank');
		expect(slides).toHaveLength(3);
	});

	it('data.slides and slides return the same array', async () => {
		const pptx = await createWithSlides(1);
		expect(pptx.slides).toBe(pptx.data.slides);
	});

	it('data includes theme information', async () => {
		const pptx = await Presentation.create({
			theme: { colors: { accent1: '#123456' } },
		});
		expect(pptx.data.theme).toBeDefined();
		expect(pptx.data.themeColorMap).toBeDefined();
	});

	it('data includes dimension information', async () => {
		const pptx = await Presentation.create();
		expect(pptx.data.width).toBeGreaterThan(0);
		expect(pptx.data.height).toBeGreaterThan(0);
	});
});

// ===========================================================================
// Integration: complex workflows
// ===========================================================================

describe('presentation integration scenarios', () => {
	it('full workflow: create, add slides, duplicate, remove, save, reload', async () => {
		const pptx = await Presentation.create({ title: 'Workflow Test' });

		// Add three slides
		pptx.addSlide('Title Slide').addText('Welcome', {
			fontSize: 44,
			bold: true,
			x: 100,
			y: 200,
			width: 800,
			height: 80,
		});
		pptx.addSlide('Blank').addText('Content', {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 600,
			height: 50,
		});
		pptx.addSlide('Blank').addText('End', {
			fontSize: 24,
			x: 100,
			y: 100,
			width: 600,
			height: 50,
		});
		expect(pptx.slideCount).toBe(3);

		// Duplicate slide 0
		pptx.duplicateSlide(0);
		expect(pptx.slideCount).toBe(4);

		// Remove slide 2
		pptx.removeSlide(2);
		expect(pptx.slideCount).toBe(3);

		// Move slide 2 to position 0
		pptx.moveSlide(2, 0);
		expect(pptx.slideCount).toBe(3);

		// Verify slide numbers are correct
		for (let i = 0; i < pptx.slideCount; i++) {
			expect(pptx.getSlide(i).slideNumber).toBe(i + 1);
		}

		// Save and reload
		const bytes = await pptx.save();
		const loaded = await Presentation.load(bytes.buffer as ArrayBuffer);
		expect(loaded.slideCount).toBe(3);
	});

	it('text operations work on builder-created content', async () => {
		const pptx = await Presentation.create();
		pptx.addSlide('Blank').addText('Acme Corp presents', {
			fontSize: 28,
			x: 100,
			y: 100,
			width: 700,
			height: 60,
		});
		pptx.addSlide('Blank').addText('Contact Acme Corp today', {
			fontSize: 18,
			x: 100,
			y: 400,
			width: 700,
			height: 40,
		});

		// Find
		const found = pptx.findText('Acme Corp');
		expect(found.length).toBeGreaterThanOrEqual(2);

		// Replace
		const count = pptx.replaceText('Acme Corp', 'NewCo Inc');
		expect(count).toBeGreaterThanOrEqual(2);

		// Verify replacement
		const afterReplace = pptx.findText('NewCo Inc');
		expect(afterReplace.length).toBeGreaterThanOrEqual(2);
		expect(pptx.findText('Acme Corp')).toHaveLength(0);
	});

	it('insert + sections workflow', async () => {
		const pptx = await createWithSlides(4);

		// Add sections
		const intro = pptx.addSection('Introduction', [0, 1]);
		const _body = pptx.addSection('Body', [2, 3]);

		expect(pptx.data.sections!).toHaveLength(2);

		// Insert a slide in the middle
		pptx.insertSlide(2, 'Blank').addText('New slide', {
			x: 0,
			y: 0,
			width: 400,
			height: 50,
		});
		expect(pptx.slideCount).toBe(5);

		// Remove the section
		pptx.removeSection(intro.id);
		expect(pptx.getSlide(0).sectionName).toBeUndefined();
	});
});
