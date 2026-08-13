import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildParagraphs } from './text-paragraphs';
import { resolveRunRuby } from './text-run-ruby';

const BLOCK_FONT = { fontFamily: 'Arial, sans-serif', fontSizePx: 20 };

describe('resolveRunRuby', () => {
	it('returns nothing for a segment with no annotation', () => {
		expect(resolveRunRuby({ text: 'kanji' }, 20, BLOCK_FONT)).toBeUndefined();
		expect(resolveRunRuby({ text: 'kanji', rubyText: '' }, 20, BLOCK_FONT)).toBeUndefined();
	});

	it('sizes the annotation at half the base when a:rubyPr declares none', () => {
		const ruby = resolveRunRuby({ text: '漢字', rubyText: 'かんじ' }, 24, BLOCK_FONT);
		expect(ruby?.text).toBe('かんじ');
		expect(ruby?.style.fontSize).toBe('12px');
		expect(ruby?.style.textAlign).toBe('center');
	});

	it('honours an explicit annotation size, family and colour', () => {
		const ruby = resolveRunRuby(
			{
				text: '漢字',
				rubyText: 'かんじ',
				rubyFontSize: 9,
				rubyAlignment: 'r',
				rubyStyle: { fontFamily: 'Meiryo', color: '#FF0000' },
			},
			24,
			BLOCK_FONT,
		);
		expect(ruby?.style.fontSize).toBe('9px');
		expect(String(ruby?.style.fontFamily)).toContain('Meiryo');
		expect(ruby?.style.textAlign).toBe('right');
		expect(ruby?.style.color).toBe('#FF0000');
	});

	it('spreads a distributed alignment across the base', () => {
		for (const alignment of ['dist', 'distCat', 'distLetter']) {
			expect(
				resolveRunRuby({ text: 'a', rubyText: 'b', rubyAlignment: alignment }, 20, BLOCK_FONT)
					?.style.textAlign,
			).toBe('justify');
		}
	});
});

describe('buildParagraphs ruby runs', () => {
	function element(text: string, rubyText: string): PptxElement {
		return {
			id: 'r1',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 60,
			text,
			textStyle: { fontSize: 20 },
			textSegments: [{ text, rubyText, style: { fontSize: 20 } }],
		} as unknown as PptxElement;
	}

	// The annotation used to reach React only: `buildParagraphs` returned
	// `{ text, style }` and never read `seg.rubyText`, so the phonetic guide
	// vanished in the other four bindings (the base text still painted, which is
	// why nothing looked broken).
	it('carries the annotation on the run so every binding can render it', () => {
		const [paragraph] = buildParagraphs(element('漢字', 'かんじ'));
		expect(paragraph.runs).toHaveLength(1);
		expect(paragraph.runs[0].ruby?.text).toBe('かんじ');
	});

	// A ruby segment is NOT put through the per-word metric split: the annotation
	// belongs to the whole segment, so splitting would repeat the same reading
	// over every word of the base text.
	it('emits a multi-word ruby segment as ONE run, not one per word', () => {
		const [paragraph] = buildParagraphs(element('two words here', 'reading'));
		expect(paragraph.runs).toHaveLength(1);
		expect(paragraph.runs[0].text).toBe('two words here');
		expect(paragraph.runs[0].ruby?.text).toBe('reading');
	});
});
