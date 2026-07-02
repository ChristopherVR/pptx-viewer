/**
 * version-history-helpers.test.ts: Unit tests for the byte-size formatter split
 * out of the version-history panel. (The IndexedDB accessors are exercised via
 * the panel; only the pure formatter is unit tested here.)
 */

import { describe, expect, it } from 'vitest';

import { formatFileSize } from './version-history-helpers';

describe('formatFileSize', () => {
	it('formats sub-kilobyte sizes in bytes', () => {
		expect(formatFileSize(0)).toBe('0 B');
		expect(formatFileSize(512)).toBe('512 B');
	});

	it('formats kilobyte-range sizes with one decimal', () => {
		expect(formatFileSize(1024)).toBe('1.0 KB');
		expect(formatFileSize(1536)).toBe('1.5 KB');
	});

	it('formats megabyte-range sizes with one decimal', () => {
		expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
	});
});
