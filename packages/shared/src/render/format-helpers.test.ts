import { describe, expect, it } from 'vitest';

import { formatIsoDate, formatRelativeTime, formatVersionTimestamp } from './format-helpers';

describe('format-helpers', () => {
	describe('formatIsoDate', () => {
		it('returns the no-value marker for an absent value', () => {
			expect(formatIsoDate(undefined)).toBe('—');
			expect(formatIsoDate('')).toBe('—');
		});

		it('echoes an unparseable string verbatim', () => {
			expect(formatIsoDate('not-a-date')).toBe('not-a-date');
		});

		it('formats a valid ISO string into a non-empty locale string', () => {
			const out = formatIsoDate('2024-01-02T03:04:05Z');
			expect(out).not.toBe('—');
			expect(out.length).toBeGreaterThan(0);
		});
	});

	describe('formatVersionTimestamp', () => {
		it('produces a non-empty short label for an epoch-ms value', () => {
			const out = formatVersionTimestamp(Date.UTC(2024, 5, 25, 2, 14));
			expect(out.length).toBeGreaterThan(0);
		});
	});

	describe('formatRelativeTime', () => {
		const now = Date.now();

		it('reports "Just now" for the present', () => {
			expect(formatRelativeTime(now)).toBe('Just now');
		});

		it('reports minutes for the recent past', () => {
			expect(formatRelativeTime(now - 5 * 60_000)).toBe('5m ago');
		});

		it('reports hours past an hour', () => {
			expect(formatRelativeTime(now - 3 * 60 * 60_000)).toBe('3h ago');
		});

		it('reports days past a day', () => {
			expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000)).toBe('2d ago');
		});
	});
});
