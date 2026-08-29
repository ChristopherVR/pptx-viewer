import { describe, expect, it } from 'vitest';

import { centeredSvgTextLines } from './svg-text-lines';
import { wrapTextByEstimatedWidth } from './text-wrap-estimate';

describe('wrapTextByEstimatedWidth', () => {
	it('keeps every word when a long line is broken up', () => {
		const text = 'Limited access to digital infrastructure in rural villages';
		const lines = wrapTextByEstimatedWidth(text, 120, 12);

		expect(lines.length).toBeGreaterThan(1);
		expect(lines.join(' ')).toBe(text);
	});

	it('honours authored line breaks', () => {
		const lines = wrapTextByEstimatedWidth('first\nsecond', 400, 12);
		expect(lines).toStrictEqual(['first', 'second']);
	});

	it('drops blank authored lines by default and keeps them on request', () => {
		expect(wrapTextByEstimatedWidth('a\n\nb', 400, 12)).toStrictEqual(['a', 'b']);
		expect(wrapTextByEstimatedWidth('a\n\nb', 400, 12, { keepBlankLines: true })).toStrictEqual([
			'a',
			'',
			'b',
		]);
	});

	it('gives an over-long word its own line rather than splitting it', () => {
		const lines = wrapTextByEstimatedWidth('short Unsplittableverylongtoken', 40, 12);
		expect(lines).toContain('Unsplittableverylongtoken');
	});

	it('wraps CJK text between glyphs without inserting spaces', () => {
		const lines = wrapTextByEstimatedWidth(
			'\u4e2d\u6587\u6587\u672c\u53ef\u4ee5\u6362\u884c',
			30,
			12,
		);
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.join('')).toBe('\u4e2d\u6587\u6587\u672c\u53ef\u4ee5\u6362\u884c');
	});

	it('keeps CJK closing punctuation on the preceding line', () => {
		const lines = wrapTextByEstimatedWidth('\u4e2d\u6587\uff0c\u6362\u884c', 24, 12);
		expect(lines[0]).toBe('\u4e2d\u6587\uff0c');
	});

	it('returns nothing for empty or blank text', () => {
		expect(wrapTextByEstimatedWidth('', 100, 12)).toStrictEqual([]);
		expect(wrapTextByEstimatedWidth('   ', 100, 12)).toStrictEqual([]);
	});
});

describe('centeredSvgTextLines', () => {
	it('places a single line on the centre baseline', () => {
		const lines = centeredSvgTextLines('one', 10);
		expect(lines).toStrictEqual([{ text: 'one', y: 0 }]);
	});

	it('centres a two-line block around the centre baseline', () => {
		const lines = centeredSvgTextLines('one\ntwo', 10);
		expect(lines.map((line) => line.y)).toStrictEqual([-6, 6]);
	});

	it('offsets the whole block when a centre is given', () => {
		const lines = centeredSvgTextLines('one\ntwo', 10, { centerY: 100 });
		expect(lines.map((line) => line.y)).toStrictEqual([94, 106]);
	});

	it('wraps to a width when one is given', () => {
		const lines = centeredSvgTextLines('alpha beta gamma delta', 10, { maxWidth: 40 });
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.map((line) => line.text).join(' ')).toBe('alpha beta gamma delta');
	});

	it('yields one empty line for empty text so single-line geometry is unchanged', () => {
		expect(centeredSvgTextLines('', 10)).toStrictEqual([{ text: '', y: 0 }]);
		expect(centeredSvgTextLines('', 10, { centerY: 50 })).toStrictEqual([{ text: '', y: 50 }]);
	});
});
