import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { compareSlide, compareSlides, diffSlideElements } from './slide-compare';

function shape(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function textEl(id: string, text: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text,
		...overrides,
	} as PptxElement;
}

function slide(
	id: string,
	elements: PptxElement[] = [],
	overrides: Partial<PptxSlide> = {},
): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements,
		...overrides,
	};
}

describe('diffSlideElements', () => {
	it('reports an added element', () => {
		const changes = diffSlideElements([shape('a')], [shape('a'), shape('b')]);
		expect(changes).toHaveLength(1);
		expect(changes[0].kind).toBe('added');
		expect(changes[0].elementId).toBe('b');
	});

	it('reports a removed element', () => {
		const changes = diffSlideElements([shape('a'), shape('b')], [shape('a')]);
		expect(changes).toHaveLength(1);
		expect(changes[0].kind).toBe('removed');
		expect(changes[0].elementId).toBe('b');
	});

	it('reports a moved element when displacement exceeds tolerance', () => {
		const changes = diffSlideElements([shape('a', { x: 0, y: 0 })], [shape('a', { x: 50, y: 0 })]);
		expect(changes.map((c) => c.kind)).toStrictEqual(['moved']);
	});

	it('ignores sub-threshold position jitter', () => {
		const changes = diffSlideElements([shape('a', { x: 0 })], [shape('a', { x: 1 })]);
		expect(changes).toHaveLength(0);
	});

	it('reports a resize when dimensions exceed tolerance', () => {
		const changes = diffSlideElements(
			[shape('a', { width: 100, height: 50 })],
			[shape('a', { width: 200, height: 50 })],
		);
		expect(changes.map((c) => c.kind)).toStrictEqual(['resized']);
	});

	it('reports a text change', () => {
		const changes = diffSlideElements([textEl('a', 'hello')], [textEl('a', 'world')]);
		expect(changes.map((c) => c.kind)).toStrictEqual(['textChanged']);
	});

	it('descends into group children', () => {
		const baseGroup = shape('g', {
			type: 'group',
			children: [shape('child', { x: 0 })],
		} as Partial<PptxElement>);
		const compareGroup = shape('g', {
			type: 'group',
			children: [shape('child', { x: 80 })],
		} as Partial<PptxElement>);
		const changes = diffSlideElements([baseGroup], [compareGroup]);
		expect(changes.some((c) => c.elementId === 'child' && c.kind === 'moved')).toBeTruthy();
	});
});

describe('compareSlide', () => {
	it('returns no changes for identical slides', () => {
		const base = slide('s1', [shape('a')]);
		const compare = slide('s1', [shape('a')]);
		expect(compareSlide(base, compare)).toHaveLength(0);
	});

	it('detects a background change', () => {
		const base = slide('s1', [], { backgroundColor: '#fff' });
		const compare = slide('s1', [], { backgroundColor: '#000' });
		const changes = compareSlide(base, compare);
		expect(changes).toHaveLength(1);
		expect(changes[0].elementId).toBe('__background__');
	});

	it('detects a speaker-notes change', () => {
		const base = slide('s1', [], { notes: 'first' });
		const compare = slide('s1', [], { notes: 'second' });
		const changes = compareSlide(base, compare);
		expect(changes.some((c) => c.elementId === '__notes__')).toBeTruthy();
	});
});

describe('compareSlides', () => {
	it('marks identical decks unchanged', () => {
		const result = compareSlides([slide('s1', [shape('a')])], [slide('s1', [shape('a')])]);
		expect(result.unchangedCount).toBe(1);
		expect(result.changedCount).toBe(0);
		expect(result.diffs[0].status).toBe('unchanged');
	});

	it('reports an added trailing slide', () => {
		const result = compareSlides([slide('s1')], [slide('s1'), slide('s2')]);
		expect(result.addedCount).toBe(1);
		const added = result.diffs.find((d) => d.status === 'added');
		expect(added?.baseIndex).toBe(-1);
		expect(added?.compareIndex).toBe(1);
		expect(added?.compareSlide?.id).toBe('s2');
	});

	it('reports a removed trailing slide', () => {
		const result = compareSlides([slide('s1'), slide('s2')], [slide('s1')]);
		expect(result.removedCount).toBe(1);
		const removed = result.diffs.find((d) => d.status === 'removed');
		expect(removed?.compareIndex).toBe(-1);
		expect(removed?.baseSlide?.id).toBe('s2');
	});

	it('reports a changed slide with element changes attached', () => {
		const result = compareSlides(
			[slide('s1', [shape('a', { x: 0 })])],
			[slide('s1', [shape('a', { x: 99 })])],
		);
		expect(result.changedCount).toBe(1);
		const changed = result.diffs.find((d) => d.status === 'changed');
		expect(changed?.changes.map((c) => c.kind)).toStrictEqual(['moved']);
	});

	it('summarises mixed add/remove/change counts', () => {
		const base = [slide('s1', [shape('a', { x: 0 })]), slide('s2')];
		const compare = [slide('s1', [shape('a', { x: 99 })]), slide('s2'), slide('s3')];
		const result = compareSlides(base, compare);
		expect(result.baseSlideCount).toBe(2);
		expect(result.compareSlideCount).toBe(3);
		expect(result.changedCount).toBe(1);
		expect(result.addedCount).toBe(1);
		expect(result.unchangedCount).toBe(1);
	});
});
