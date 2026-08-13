import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	cloneChartData,
	cloneElement,
	cloneHistorySnapshot,
	cloneShapeStyle,
	cloneSlide,
	cloneTextStyle,
	cloneXmlObject,
} from './clone';

function textEl(id: string, text: string): PptxElement {
	return {
		id,
		type: 'text',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		text,
		textSegments: [{ text, style: { bold: true } }],
		textStyle: { color: '#111' },
	} as unknown as PptxElement;
}

describe('clone helpers', () => {
	it('cloneTextStyle / cloneShapeStyle return new objects and pass undefined through', () => {
		const ts = { bold: true };
		expect(cloneTextStyle(ts)).not.toBe(ts);
		expect(cloneTextStyle(ts)).toStrictEqual(ts);
		expect(cloneTextStyle(undefined)).toBeUndefined();
		const ss = { fillColor: '#fff', fillGradientStops: [{ color: '#000', position: 0 }] } as never;
		const clonedSs = cloneShapeStyle(ss);
		expect(clonedSs).not.toBe(ss);
		// Nested gradient stops are deep-copied.
		expect((clonedSs as { fillGradientStops: unknown[] }).fillGradientStops[0]).not.toBe(
			(ss as { fillGradientStops: unknown[] }).fillGradientStops[0],
		);
	});

	it('cloneElement deep-copies text segments without mutating the source', () => {
		const el = textEl('t1', 'hi');
		const clone = cloneElement(el);
		expect(clone).not.toBe(el);
		const src = el as unknown as { textSegments: { style: { bold: boolean } }[] };
		const out = clone as unknown as { textSegments: { style: { bold: boolean } }[] };
		expect(out.textSegments[0]).not.toBe(src.textSegments[0]);
		out.textSegments[0].style.bold = false;
		expect(src.textSegments[0].style.bold).toBeTruthy();
	});

	it('cloneChartData deep-copies categories and series values', () => {
		const data = { categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] } as never;
		const clone = cloneChartData(data);
		expect(clone).not.toBe(data);
		expect(clone?.categories).not.toBe((data as { categories: unknown }).categories);
		expect(clone?.series[0].values).not.toBe(
			(data as { series: { values: unknown }[] }).series[0].values,
		);
	});

	// A group used to be copied with `{ ...element }`, which SHARES the children
	// array: editing a shape inside the copy wrote through to the original (and
	// to the undo snapshot this helper exists to isolate). Nesting multiplies
	// the aliased surface, so the whole subtree is checked.
	it('cloneElement deep-clones a nested group instead of aliasing its children', () => {
		const leaf = textEl('leaf', 'x');
		const inner = {
			id: 'inner',
			type: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [leaf],
		} as unknown as PptxElement;
		const outer = {
			id: 'outer',
			type: 'group',
			x: 0,
			y: 0,
			width: 20,
			height: 20,
			children: [inner],
		} as unknown as PptxElement;

		const clone = cloneElement(outer) as PptxElement & { children: PptxElement[] };
		const clonedInner = clone.children[0] as PptxElement & { children: PptxElement[] };
		expect(clone.children).not.toBe((outer as { children: unknown }).children);
		expect(clonedInner).not.toBe(inner);
		expect(clonedInner.children[0]).not.toBe(leaf);

		// Mutate the clone's deepest descendant: the original must not move.
		clonedInner.children[0].x = 999;
		clonedInner.children[0].id = 'renamed';
		expect(leaf.x).toBe(0);
		expect(leaf.id).toBe('leaf');
	});

	// This module used to carry its own copy of the element clone, and the two
	// copies drifted: neither cloned a table's rows. The binding entry point is
	// now core's single implementation, so a variant it covers must be covered
	// here too; if someone re-adds a local switch, this fails.
	it('cloneElement deep-copies a table through the shared entry point', () => {
		const el = {
			id: 'tbl',
			type: 'table',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			tableData: { rows: [{ cells: [{ text: 'a' }] }], columnWidths: [1] },
		} as unknown as PptxElement;

		const clone = cloneElement(el) as unknown as {
			tableData: { rows: { cells: { text: string }[] }[] };
		};
		clone.tableData.rows[0].cells[0].text = 'edited';

		const source = el as unknown as { tableData: { rows: { cells: { text: string }[] }[] } };
		expect(source.tableData.rows[0].cells[0].text).toBe('a');
	});

	it('cloneSlide clones elements array and entries', () => {
		const slide = { id: 's1', elements: [textEl('a', 'x')] } as unknown as PptxSlide;
		const clone = cloneSlide(slide);
		expect(clone).not.toBe(slide);
		expect(clone.elements).not.toBe(slide.elements);
		expect(clone.elements[0]).not.toBe(slide.elements[0]);
	});

	it('cloneHistorySnapshot rebuilds structural fields and deep-clones slides', () => {
		const snap = {
			width: 1280,
			height: 720,
			activeSlideIndex: 1,
			slides: [{ id: 's1', elements: [textEl('a', 'x')] } as unknown as PptxSlide],
			templateElementsBySlideId: { s1: [textEl('tpl', 'y')] },
		};
		const clone = cloneHistorySnapshot(snap);
		expect(clone).not.toBe(snap);
		expect(clone.width).toBe(1280);
		expect(clone.activeSlideIndex).toBe(1);
		expect(clone.slides[0]).not.toBe(snap.slides[0]);
		expect(clone.templateElementsBySlideId.s1[0]).not.toBe(snap.templateElementsBySlideId.s1[0]);
	});

	it('cloneXmlObject deep-clones via JSON and returns undefined on input undefined', () => {
		const xml = { a: { b: 1 } } as never;
		const clone = cloneXmlObject(xml);
		expect(clone).toStrictEqual(xml);
		expect(clone).not.toBe(xml);
		expect(cloneXmlObject(undefined)).toBeUndefined();
	});
});
