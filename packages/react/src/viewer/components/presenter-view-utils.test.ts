import { describe, it, expect } from 'vitest';
import { formatElapsed } from './presenter-view-utils';

describe('formatElapsed', () => {
	it('should format 0 ms as 00:00', () => {
		expect(formatElapsed(0)).toBe('00:00');
	});

	it('should format 1000 ms as 00:01', () => {
		expect(formatElapsed(1000)).toBe('00:01');
	});

	it('should format 60000 ms as 01:00', () => {
		expect(formatElapsed(60000)).toBe('01:00');
	});

	it('should format 90000 ms as 01:30', () => {
		expect(formatElapsed(90000)).toBe('01:30');
	});

	it('should pad single-digit minutes and seconds', () => {
		expect(formatElapsed(5000)).toBe('00:05');
		expect(formatElapsed(65000)).toBe('01:05');
	});

	it('should handle large values (> 1 hour)', () => {
		// 3661 seconds = 61:01
		expect(formatElapsed(3661000)).toBe('61:01');
	});

	it('should truncate sub-second values (floor)', () => {
		expect(formatElapsed(1500)).toBe('00:01');
		expect(formatElapsed(999)).toBe('00:00');
	});

	it('should format 10 minutes exactly', () => {
		expect(formatElapsed(600000)).toBe('10:00');
	});
});
