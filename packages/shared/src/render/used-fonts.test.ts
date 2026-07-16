import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { collectFontsFromElement, collectUsedFonts } from './used-fonts';

const text = (id: string, family?: string, segmentFamily?: string): PptxElement =>
	({
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		text: 'Text',
		textStyle: family ? { fontFamily: family } : undefined,
		textSegments: segmentFamily ? [{ text: 'Text', style: { fontFamily: segmentFamily } }] : [],
	}) as PptxElement;

const slide = (elements: PptxElement[]): PptxSlide =>
	({ id: 'slide', rId: 'rId1', slideNumber: 1, elements }) as PptxSlide;

describe('used font collection', () => {
	it('deduplicates and sorts element and segment fonts', () => {
		expect(
			collectUsedFonts([slide([text('a', 'Zephyr'), text('b', 'Arial', 'Zephyr')])]),
		).toStrictEqual(['Arial', 'Zephyr']);
	});

	it('recurses through nested groups', () => {
		const nested = {
			type: 'group',
			id: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [text('child', 'Aptos')],
		} as PptxElement;
		const fonts = new Set<string>();
		collectFontsFromElement(nested, fonts);
		expect([...fonts]).toStrictEqual(['Aptos']);
	});

	it('returns an empty list when no element specifies a font', () => {
		expect(collectUsedFonts([slide([])])).toStrictEqual([]);
	});
});
