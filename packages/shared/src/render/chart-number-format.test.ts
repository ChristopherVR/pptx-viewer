import { describe, it, expect } from 'vitest';

import { formatChartNumber, formatChartNumberWithColor } from './chart-number-format';

describe('formatChartNumber', () => {
	it('renders a percentage format against the cached fraction', () => {
		// The issue #132 deck: the axis is `0%` and the cache holds 0.52.
		expect(formatChartNumber(0.52, '0%')).toBe('52%');
		expect(formatChartNumber(0.04, '0%')).toBe('4%');
		expect(formatChartNumber(0.6, '0%')).toBe('60%');
		expect(formatChartNumber(0, '0%')).toBe('0%');
	});

	it('honours the decimal count in a percentage format', () => {
		expect(formatChartNumber(0.5237, '0.0%')).toBe('52.4%');
		expect(formatChartNumber(0.5237, '0.00%')).toBe('52.37%');
	});

	it('pads and groups plain numeric formats', () => {
		expect(formatChartNumber(1234.5, '#,##0')).toBe('1,235');
		expect(formatChartNumber(1234.5, '#,##0.00')).toBe('1,234.50');
		expect(formatChartNumber(7, '000')).toBe('007');
		expect(formatChartNumber(3.14159, '0.00')).toBe('3.14');
	});

	it('drops optional decimals but keeps required ones', () => {
		expect(formatChartNumber(3.5, '0.##')).toBe('3.5');
		expect(formatChartNumber(3, '0.##')).toBe('3');
		expect(formatChartNumber(3, '0.00')).toBe('3.00');
		expect(formatChartNumber(0.5, '#.##')).toBe('.5');
		expect(formatChartNumber(0.5, '0.##')).toBe('0.5');
	});

	it('keeps literal prefixes and suffixes', () => {
		expect(formatChartNumber(1234, '$#,##0')).toBe('$1,234');
		expect(formatChartNumber(12, '0" units"')).toBe('12 units');
		expect(formatChartNumber(12, '0\\u')).toBe('12u');
	});

	it('scales by a trailing comma', () => {
		expect(formatChartNumber(1_500_000, '#,##0,,"M"')).toBe('2M');
		expect(formatChartNumber(2400, '0,')).toBe('2');
	});

	it('selects the negative and zero sections', () => {
		expect(formatChartNumber(-5, '0;(0)')).toBe('(5)');
		expect(formatChartNumber(5, '0;(0)')).toBe('5');
		expect(formatChartNumber(0, '0;(0);"-"')).toBeUndefined();
		// The zero section is its own pattern, so it brings its own decimals.
		expect(formatChartNumber(0, '0.0;(0.0);0"!"')).toBe('0!');
	});

	it('signs a negative number when there is only one section', () => {
		expect(formatChartNumber(-0.25, '0%')).toBe('-25%');
		expect(formatChartNumber(-1234, '#,##0')).toBe('-1,234');
	});

	it('renders scientific notation', () => {
		expect(formatChartNumber(12345, '0.00E+00')).toBe('1.23E+04');
		expect(formatChartNumber(0.00012, '0.0E+00')).toBe('1.2E-04');
	});

	it('ignores colour and condition blocks', () => {
		expect(formatChartNumber(1234, '[Blue]#,##0')).toBe('1,234');
	});

	it('defers to the caller for General and unusable codes', () => {
		expect(formatChartNumber(1.5, 'General')).toBeUndefined();
		expect(formatChartNumber(1.5, '')).toBeUndefined();
		expect(formatChartNumber(1.5, undefined)).toBeUndefined();
		expect(formatChartNumber(1.5, '@')).toBeUndefined();
		expect(formatChartNumber(1.5, 'yyyy-mm-dd')).toBeUndefined();
		expect(formatChartNumber(Number.NaN, '0%')).toBeUndefined();
	});
});

describe('formatChartNumberWithColor', () => {
	it('surfaces the [Red] section colour for a negative value', () => {
		expect(formatChartNumberWithColor(-42, '#,##0;[Red]-#,##0')).toStrictEqual({
			text: '-42',
			color: '#FF0000',
		});
	});

	it('a positive value uses the (uncoloured) positive section', () => {
		expect(formatChartNumberWithColor(42, '#,##0;[Red]-#,##0')).toStrictEqual({
			text: '42',
			color: undefined,
		});
	});

	it('recognises every ECMA-376 18.8.30 named colour, case-insensitively', () => {
		expect(formatChartNumberWithColor(1, '[Blue]0')?.color).toBe('#0000FF');
		expect(formatChartNumberWithColor(1, '[GREEN]0')?.color).toBe('#00FF00');
	});

	it('ignores an unrecognised bracket token instead of crashing', () => {
		const result = formatChartNumberWithColor(1234, '[Color3]#,##0');
		expect(result?.text).toBe('1,234');
		expect(result?.color).toBeUndefined();
	});

	it('formatChartNumber keeps returning a bare string (sibling-function contract)', () => {
		expect(formatChartNumber(-42, '#,##0;[Red]-#,##0')).toBe('-42');
	});
});
