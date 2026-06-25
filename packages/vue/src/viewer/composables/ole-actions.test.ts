import { describe, expect, it } from 'vitest';

import { formatBytes, isBrowserOpenableMime } from './ole-actions';

describe('formatBytes', () => {
	it('returns undefined for missing / invalid input', () => {
		expect(formatBytes(undefined)).toBeUndefined();
		expect(formatBytes(Number.NaN)).toBeUndefined();
		expect(formatBytes(-1)).toBeUndefined();
		expect(formatBytes(Number.POSITIVE_INFINITY)).toBeUndefined();
	});

	it('formats bytes below 1 KB as whole bytes', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1023)).toBe('1023 B');
	});

	it('formats larger sizes with one decimal, dropping trailing .0', () => {
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1024 * 1024)).toBe('1 MB');
		expect(formatBytes(Math.round(2.3 * 1024 * 1024))).toBe('2.3 MB');
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
	});
});

describe('isBrowserOpenableMime', () => {
	it('returns false for missing / unknown / binary types', () => {
		expect(isBrowserOpenableMime(undefined)).toBeFalsy();
		expect(isBrowserOpenableMime('')).toBeFalsy();
		expect(isBrowserOpenableMime('application/octet-stream')).toBeFalsy();
		expect(
			isBrowserOpenableMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
		).toBeFalsy();
	});

	it('returns true for pdf, images, text, and a few text-ish app types', () => {
		expect(isBrowserOpenableMime('application/pdf')).toBeTruthy();
		expect(isBrowserOpenableMime('image/png')).toBeTruthy();
		expect(isBrowserOpenableMime('IMAGE/JPEG')).toBeTruthy();
		expect(isBrowserOpenableMime('text/plain')).toBeTruthy();
		expect(isBrowserOpenableMime(' text/html ')).toBeTruthy();
		expect(isBrowserOpenableMime('application/json')).toBeTruthy();
		expect(isBrowserOpenableMime('application/xml')).toBeTruthy();
	});
});
