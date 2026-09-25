import { afterEach, describe, expect, it } from 'vitest';

import {
	dataLabelBox,
	dataLabelBoxSize,
	estimateChartTextWidth,
	measureChartTextWidth,
	setChartTextMeasurer,
} from './chart-label-measure';
import type { SvgText } from './chart-svg-primitives';

const PT = 4 / 3;

function label(text: string, extra: Partial<SvgText> = {}): SvgText {
	return {
		kind: 'text',
		x: 100,
		y: 50,
		text,
		fontSize: 12 * PT,
		fill: '#404040',
		textAnchor: 'middle',
		dominantBaseline: 'central',
		fontFamily: 'Calibri',
		...extra,
	};
}

/** Calibri's advances (em): digits, "C", "a", "t", space. */
const CALIBRI: Record<string, number> = {
	'0': 0.5068,
	'1': 0.5068,
	'2': 0.5068,
	'4': 0.5068,
	'5': 0.5068,
	'%': 0.7153,
	C: 0.5332,
	a: 0.4785,
	t: 0.3345,
	' ': 0.2261,
};

afterEach(() => setChartTextMeasurer(undefined));

describe('measureChartTextWidth', () => {
	it('falls back to the per-character estimate with no DOM', () => {
		expect(measureChartTextWidth('25', { fontSize: 16 })).toBe(estimateChartTextWidth('25', 16));
	});

	it('uses an injected measurer, and the estimate when it cannot measure', () => {
		setChartTextMeasurer((text, font) => text.length * font.fontSize);
		expect(measureChartTextWidth('abc', { fontSize: 10 })).toBe(30);
		setChartTextMeasurer(() => undefined);
		expect(measureChartTextWidth('abc', { fontSize: 10 })).toBe(estimateChartTextWidth('abc', 10));
	});

	it('hands the measurer the label font', () => {
		const seen: unknown[] = [];
		setChartTextMeasurer((_text, font) => {
			seen.push(font);
			return 1;
		});
		dataLabelBoxSize(label('25', { fontWeight: 'bold', fontStyle: 'italic' }));
		expect(seen).toStrictEqual([
			{ fontSize: 16, fontFamily: 'Calibri', fontWeight: 'bold', fontStyle: 'italic' },
		]);
	});
});

describe('dataLabelBoxSize (COM: DataLabel.Width/Height of boxed 12pt Calibri labels)', () => {
	const calibri = (text: string, font: { fontSize: number }) =>
		[...text].reduce((sum, ch) => sum + (CALIBRI[ch] ?? 0.5) * font.fontSize, 0);

	it('is the text width plus 3pt a side, and one 1.2207em line plus 1.5pt top and bottom', () => {
		setChartTextMeasurer(calibri);
		const two = dataLabelBoxSize(label('25'));
		expect(two.w / PT).toBeCloseTo(18.16, 1);
		expect(two.h / PT).toBeCloseTo(17.65, 1);
		const one = dataLabelBoxSize(label('5'));
		expect(one.w / PT).toBeCloseTo(12.08, 1);
	});

	it('sizes a two-line label by its widest line (COM: "Cat 1" / "40%" is 30.86 x 32.3pt)', () => {
		setChartTextMeasurer(calibri);
		const box = dataLabelBoxSize(label('Cat 1\n40%'));
		expect(box.w / PT).toBeCloseTo(30.86, 0);
		expect(box.h / PT).toBeCloseTo(32.3, 1);
	});
});

describe('dataLabelBox', () => {
	it('centres the box on a middle / central label', () => {
		setChartTextMeasurer(() => 20);
		const box = dataLabelBox(label('x'));
		expect(box.x).toBe(86);
		expect(box.w).toBe(28);
		expect(box.h).toBeCloseTo(16 * 1.2207 + 4, 5);
		expect(box.y + box.h / 2).toBeCloseTo(50, 5);
	});

	it('hangs the box off a start-anchored baseline label', () => {
		setChartTextMeasurer(() => 20);
		const box = dataLabelBox(label('x', { textAnchor: 'start', dominantBaseline: undefined }));
		expect(box.x).toBe(96);
		expect(box.y).toBeCloseTo(50 - 16 * 0.952 - 2, 5);
	});
});
