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
