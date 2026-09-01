import { describe, expect, it } from 'vitest';

import { hexToRgbUnit } from './color-units';

describe('hexToRgbUnit', () => {
	it('parses a 6-digit hex colour with a leading #', () => {
		expect(hexToRgbUnit('#ff0080')).toStrictEqual({ r: 1, g: 0, b: 0.5019607843137255 });
	});

	it('parses a 6-digit hex colour without a leading #', () => {
		expect(hexToRgbUnit('ff0080')).toStrictEqual({ r: 1, g: 0, b: 0.5019607843137255 });
	});

	it('parses black and white', () => {
		expect(hexToRgbUnit('#000000')).toStrictEqual({ r: 0, g: 0, b: 0 });
		expect(hexToRgbUnit('#ffffff')).toStrictEqual({ r: 1, g: 1, b: 1 });
	});

	it('falls back invalid/short channels to 0 (3-digit shorthand is NOT expanded)', () => {
		// "fff" -> substring(0,2)="ff"=1, substring(2,4)="f" (1 char) parses to
		// 15/255, substring(4,6)="" parses to NaN -> 0. Preserves the exact
		// behaviour of every prior copy of this function.
		expect(hexToRgbUnit('#fff')).toStrictEqual({ r: 1, g: 15 / 255, b: 0 });
	});

	it('falls back a completely invalid string to all-zero', () => {
		expect(hexToRgbUnit('zzzzzz')).toStrictEqual({ r: 0, g: 0, b: 0 });
	});
});
