import { describe, expect, it } from 'vitest';

import { formatDate } from './chart-date-format';

const D = new Date(Date.UTC(2024, 0, 5, 13, 4, 9)); // 2024-01-05 13:04:09 UTC (a Friday)

describe('formatDate token renderer', () => {
	it('renders an all-numeric US date exactly as authored (mm/dd/yyyy)', () => {
		expect(formatDate(D, 'days', 'mm/dd/yyyy')).toBe('01/05/2024');
	});

	it('renders an abbreviated-month, 2-digit-year date (dd-mmm-yy)', () => {
		expect(formatDate(D, 'days', 'dd-mmm-yy')).toBe('05-Jan-24');
	});

	it('distinguishes mmmm (full month name) from mmm (abbreviated)', () => {
		expect(formatDate(D, 'months', 'mmmm yyyy')).toBe('January 2024');
		expect(formatDate(D, 'months', 'mmm yyyy')).toBe('Jan 2024');
	});

	it('renders full and abbreviated weekday names (dddd / ddd)', () => {
		expect(formatDate(D, 'days', 'dddd')).toBe('Friday');
		expect(formatDate(D, 'days', 'ddd, d mmm')).toBe('Fri, 5 Jan');
	});

	it('honours quoted literal text and backslash escapes', () => {
		expect(formatDate(D, 'days', 'yyyy"-Q"m')).toBe('2024-Q1');
		expect(formatDate(D, 'days', 'd\\.m\\.yyyy')).toBe('5.1.2024');
	});

	it('reads m as MINUTES only when adjacent to an hour or second token', () => {
		expect(formatDate(D, 'days', 'h:mm:ss')).toBe('13:04:09');
		expect(formatDate(D, 'days', 'mm:ss')).toBe('04:09');
		// Not adjacent to h/s: m means month here.
		expect(formatDate(D, 'days', 'm/d/yyyy')).toBe('1/5/2024');
	});

	it('renders 12-hour AM/PM markers, matching the code token case', () => {
		expect(formatDate(D, 'days', 'h:mm AM/PM')).toBe('1:04 PM');
		expect(formatDate(D, 'days', 'h:mm am/pm')).toBe('1:04 pm');
	});

	it('falls back to the calendar-unit heuristic for an absent/unusable code', () => {
		expect(formatDate(D, 'years')).toBe('2024');
		expect(formatDate(D, 'months')).toBe('Jan 2024');
		expect(formatDate(D, 'days')).toBe('5 Jan');
		expect(formatDate(D, 'days', 'General')).toBe('5 Jan');
	});
});
