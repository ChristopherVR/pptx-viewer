import { describe, it, expect } from 'vitest';

import { formatBytes, isBrowserOpenableMime } from './ole-actions';

describe('formatBytes', () => {
	it('returns undefined for missing or invalid input', () => {
		expect(formatBytes(undefined)).toBeUndefined();
		expect(formatBytes(-1)).toBeUndefined();
		expect(formatBytes(Number.NaN)).toBeUndefined();
		expect(formatBytes(Number.POSITIVE_INFINITY)).toBeUndefined();
	});

	it('formats small byte counts with correct pluralisation', () => {
		expect(formatBytes(0)).toBe('0 bytes');
		expect(formatBytes(1)).toBe('1 byte');
		expect(formatBytes(512)).toBe('512 bytes');
	});

	it('formats KB/MB/GB with binary units', () => {
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1024 * 1024)).toBe('1 MB');
		expect(formatBytes(12 * 1024 * 1024)).toBe('12 MB');
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
	});
});

describe('isBrowserOpenableMime', () => {
	it('returns true for pdf, images, text, json, xml, xhtml', () => {
		expect(isBrowserOpenableMime('application/pdf')).toBeTruthy();
		expect(isBrowserOpenableMime('image/png')).toBeTruthy();
		expect(isBrowserOpenableMime('text/plain')).toBeTruthy();
		expect(isBrowserOpenableMime('application/json')).toBeTruthy();
		expect(isBrowserOpenableMime('application/xml')).toBeTruthy();
		expect(isBrowserOpenableMime('application/xhtml+xml')).toBeTruthy();
		expect(isBrowserOpenableMime('IMAGE/JPEG')).toBeTruthy();
	});

	it('is case-insensitive and ignores charset parameters', () => {
		expect(isBrowserOpenableMime('TEXT/Plain; charset=UTF-8')).toBeTruthy();
		expect(isBrowserOpenableMime('Application/PDF')).toBeTruthy();
	});

	it('returns false for office/binary types and missing input', () => {
		expect(isBrowserOpenableMime(undefined)).toBeFalsy();
		expect(isBrowserOpenableMime('')).toBeFalsy();
		expect(
			isBrowserOpenableMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
		).toBeFalsy();
		expect(isBrowserOpenableMime('application/octet-stream')).toBeFalsy();
	});
});
