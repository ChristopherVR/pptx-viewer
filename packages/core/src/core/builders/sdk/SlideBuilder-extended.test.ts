import { describe, it, expect, beforeEach } from 'vitest';

import { resetIdCounter, createTextElement } from './ElementFactory';
import { ShapeBuilder } from './ShapeBuilder';
import { SlideBuilder } from './SlideBuilder';
import { TextBuilder } from './TextBuilder';

beforeEach(() => {
	resetIdCounter();
});

// ---------------------------------------------------------------------------
// addFreeform
// ---------------------------------------------------------------------------

describe('slideBuilder.addFreeform', () => {
	it('adds a freeform shape element to the slide', () => {
		const slide = new SlideBuilder(1).addFreeform('M 0 0 L 100 50 L 50 100 Z').build();
		expect(slide.elements).toHaveLength(1);
		expect(slide.elements[0].type).toBe('shape');
		expect((slide.elements[0] as Record<string, unknown>).shapeType).toBe('custom');
		expect((slide.elements[0] as Record<string, unknown>).pathData).toBe(
			'M 0 0 L 100 50 L 50 100 Z',
		);
	});

	it('generates an id with frm prefix', () => {
		const slide = new SlideBuilder(1).addFreeform('M 0 0 L 100 100').build();
		expect(slide.elements[0].id).toMatch(/^frm_/);
	});

	it('accepts shape options for position and styling', () => {
		const slide = new SlideBuilder(1)
			.addFreeform('M 0 0 L 100 100', {
				x: 50,
				y: 75,
				width: 200,
				height: 150,
				stroke: { color: '#FF0000', width: 3 },
			})
			.build();
		const el = slide.elements[0];
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
		expect(el.width).toBe(200);
		expect(el.height).toBe(150);
		expect((el as { shapeStyle?: Record<string, unknown> }).shapeStyle?.strokeColor).toBe(
			'#FF0000',
		);
		expect((el as { shapeStyle?: Record<string, unknown> }).shapeStyle?.strokeWidth).toBe(3);
	});

	it('returns the builder for chaining', () => {
		const builder = new SlideBuilder(1);
		const result = builder.addFreeform('M 0 0 L 50 50');
		expect(result).toBe(builder);
	});

	it('can be chained with other element additions', () => {
		const slide = new SlideBuilder(1)
			.addText('Title')
			.addFreeform('M 0 0 C 33 0 66 100 100 100', {
				stroke: { color: '#00FF00', width: 2 },
			})
			.addShape('rect')
			.build();
		expect(slide.elements).toHaveLength(3);
		expect(slide.elements[0].type).toBe('text');
		expect(slide.elements[1].type).toBe('shape');
		expect((slide.elements[1] as Record<string, unknown>).shapeType).toBe('custom');
		expect(slide.elements[2].type).toBe('shape');
		expect((slide.elements[2] as Record<string, unknown>).shapeType).toBe('rect');
	});
});

// ---------------------------------------------------------------------------
// addBuilderElement
// ---------------------------------------------------------------------------

describe('slideBuilder.addBuilderElement', () => {
	it('calls .build() on the builder and adds the element', () => {
		const textBuilder = TextBuilder.create('Hello').fontSize(24).bold();
		const slide = new SlideBuilder(1).addBuilderElement(textBuilder).build();
		expect(slide.elements).toHaveLength(1);
		expect(slide.elements[0].type).toBe('text');
		expect((slide.elements[0] as Record<string, unknown>).text).toBe('Hello');
		expect((slide.elements[0] as Record<string, unknown>).textStyle?.fontSize).toBe(24);
		expect((slide.elements[0] as Record<string, unknown>).textStyle?.bold).toBeTruthy();
	});

	it('works with ShapeBuilder', () => {
		const shapeBuilder = ShapeBuilder.create('ellipse').solidFill('#FF0000').position(10, 20);
		const slide = new SlideBuilder(1).addBuilderElement(shapeBuilder).build();
		expect(slide.elements).toHaveLength(1);
		expect(slide.elements[0].type).toBe('shape');
		expect((slide.elements[0] as Record<string, unknown>).shapeType).toBe('ellipse');
		expect(slide.elements[0].x).toBe(10);
	});

	it('works with any object that has a .build() method', () => {
		const fakeBuilder = {
			build: () => createTextElement('Fake', { fontSize: 12 }),
		};
		const slide = new SlideBuilder(1).addBuilderElement(fakeBuilder).build();
		expect(slide.elements).toHaveLength(1);
		expect(slide.elements[0].type).toBe('text');
		expect((slide.elements[0] as Record<string, unknown>).text).toBe('Fake');
	});

	it('returns the builder for chaining', () => {
		const builder = new SlideBuilder(1);
		const result = builder.addBuilderElement(TextBuilder.create('X'));
		expect(result).toBe(builder);
	});

	it('can be chained with other add methods', () => {
		const slide = new SlideBuilder(1)
			.addText('Before')
			.addBuilderElement(ShapeBuilder.create('rect').solidFill('#0000FF'))
			.addText('After')
			.build();
		expect(slide.elements).toHaveLength(3);
		expect(slide.elements[0].type).toBe('text');
		expect(slide.elements[1].type).toBe('shape');
		expect(slide.elements[2].type).toBe('text');
	});
});

// ---------------------------------------------------------------------------
// removeElement
// ---------------------------------------------------------------------------

describe('slideBuilder.removeElement', () => {
	it('removes an element by its ID', () => {
		const builder = new SlideBuilder(1).addText('A').addText('B');
		const elements = builder.getElements();
		const idToRemove = elements[0].id;

		const slide = builder.removeElement(idToRemove).build();
		expect(slide.elements).toHaveLength(1);
		expect(slide.elements[0].id).not.toBe(idToRemove);
	});

	it('leaves the slide unchanged when ID does not match', () => {
		const slide = new SlideBuilder(1)
			.addText('A')
			.addText('B')
			.removeElement('nonexistent_id')
			.build();
		expect(slide.elements).toHaveLength(2);
	});

	it('returns the builder for chaining', () => {
		const builder = new SlideBuilder(1).addText('A');
		const result = builder.removeElement('some_id');
		expect(result).toBe(builder);
	});

	it('can remove multiple elements via chained calls', () => {
		const builder = new SlideBuilder(1).addText('A').addText('B').addText('C');
		const ids = builder.getElements().map((e) => e.id);

		const slide = builder.removeElement(ids[0]).removeElement(ids[2]).build();
		expect(slide.elements).toHaveLength(1);
		expect(slide.elements[0].id).toBe(ids[1]);
	});

	it('handles removing from an empty slide gracefully', () => {
		const slide = new SlideBuilder(1).removeElement('does_not_exist').build();
		expect(slide.elements).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// getElements
// ---------------------------------------------------------------------------

describe('slideBuilder.getElements', () => {
	it('returns an empty array for a new builder', () => {
		const builder = new SlideBuilder(1);
		expect(builder.getElements()).toStrictEqual([]);
	});

	it('returns the current elements after adding', () => {
		const builder = new SlideBuilder(1).addText('A').addShape('rect');
		const elements = builder.getElements();
		expect(elements).toHaveLength(2);
		expect(elements[0].type).toBe('text');
		expect(elements[1].type).toBe('shape');
	});

	it('reflects removals', () => {
		const builder = new SlideBuilder(1).addText('A').addText('B');
		const id = builder.getElements()[0].id;
		builder.removeElement(id);
		expect(builder.getElements()).toHaveLength(1);
	});

	it('returns a readonly view (array reference)', () => {
		const builder = new SlideBuilder(1).addText('A');
		const elements = builder.getElements();
		// Should be the same reference (readonly at type level, but same array)
		expect(elements).toHaveLength(1);
		builder.addText('B');
		// The underlying array was mutated, so the readonly view reflects it
		expect(elements).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// elementCount
// ---------------------------------------------------------------------------

describe('slideBuilder.elementCount', () => {
	it('returns 0 for a new builder', () => {
		const builder = new SlideBuilder(1);
		expect(builder.elementCount).toBe(0);
	});

	it('increments as elements are added', () => {
		const builder = new SlideBuilder(1)
			.addText('A')
			.addShape('rect')
			.addImage('data:image/png;base64,abc');
		expect(builder.elementCount).toBe(3);
	});

	it('decrements after removal', () => {
		const builder = new SlideBuilder(1).addText('A').addText('B');
		const id = builder.getElements()[0].id;
		builder.removeElement(id);
		expect(builder.elementCount).toBe(1);
	});

	it('matches getElements().length', () => {
		const builder = new SlideBuilder(1).addText('A').addShape('rect');
		expect(builder.elementCount).toBe(builder.getElements().length);
	});
});

// ---------------------------------------------------------------------------
// getLastElement
// ---------------------------------------------------------------------------

describe('slideBuilder.getLastElement', () => {
	it('returns undefined for an empty slide', () => {
		const builder = new SlideBuilder(1);
		expect(builder.getLastElement()).toBeUndefined();
	});

	it('returns the most recently added element', () => {
		const builder = new SlideBuilder(1).addText('First').addShape('rect');
		const last = builder.getLastElement();
		expect(last).toBeDefined();
		expect(last!.type).toBe('shape');
	});

	it('updates after each addition', () => {
		const builder = new SlideBuilder(1).addText('First');
		expect(builder.getLastElement()!.type).toBe('text');

		builder.addImage('data:image/png;base64,abc');
		expect(builder.getLastElement()!.type).toBe('image');
	});

	it('is useful for getting element ID for animations', () => {
		const builder = new SlideBuilder(1).addShape('rect');
		const el = builder.getLastElement();
		expect(el).toBeDefined();

		const slide = builder.addAnimation(el!.id, { preset: 'fadeIn', duration: 500 }).build();
		expect(slide.animations).toHaveLength(1);
		expect(slide.animations![0].elementId).toBe(el!.id);
	});

	it('returns undefined after removing all elements', () => {
		const builder = new SlideBuilder(1).addText('Only');
		const id = builder.getLastElement()!.id;
		builder.removeElement(id);
		expect(builder.getLastElement()).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// setName
// ---------------------------------------------------------------------------

describe('slideBuilder.setName', () => {
	it('sets the name on the built slide', () => {
		const slide = new SlideBuilder(1).setName('Introduction').build();
		expect(slide.name).toBe('Introduction');
	});

	it('returns the builder for chaining', () => {
		const builder = new SlideBuilder(1);
		const result = builder.setName('My Slide');
		expect(result).toBe(builder);
	});

	it('can be overwritten with a subsequent call', () => {
		const slide = new SlideBuilder(1).setName('Draft').setName('Final').build();
		expect(slide.name).toBe('Final');
	});

	it('chains with other slide-level setters', () => {
		const slide = new SlideBuilder(1)
			.setName('Summary')
			.setNotes('Remember the key points')
			.setHidden(false)
			.addText('Content')
			.build();
		expect(slide.name).toBe('Summary');
		expect(slide.notes).toBe('Remember the key points');
		expect(slide.elements).toHaveLength(1);
	});

	it('accepts empty string as name', () => {
		const slide = new SlideBuilder(1).setName('').build();
		expect(slide.name).toBe('');
	});
});
