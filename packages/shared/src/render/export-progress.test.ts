import { describe, expect, it } from 'vitest';

import {
	clampPercent,
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	exportAbortError,
	isExportAbortError,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from './export-progress';

describe('clampPercent', () => {
	it('clamps into the inclusive [0, 100] range', () => {
		expect(clampPercent(-10)).toBe(0);
		expect(clampPercent(0)).toBe(0);
		expect(clampPercent(50.4)).toBe(50);
		expect(clampPercent(50.6)).toBe(51);
		expect(clampPercent(100)).toBe(100);
		expect(clampPercent(150)).toBe(100);
	});

	it('treats NaN as 0', () => {
		expect(clampPercent(Number.NaN)).toBe(0);
	});
});

describe('slideProgressPercent', () => {
	it('fills the default [0, 90] band across the slide cursor', () => {
		expect(slideProgressPercent(0, 10)).toBe(0);
		expect(slideProgressPercent(5, 10)).toBe(45);
		expect(slideProgressPercent(10, 10)).toBe(90);
	});

	it('honours a custom span (e.g. 45 for a two-phase export)', () => {
		expect(slideProgressPercent(0, 4, 45)).toBe(0);
		expect(slideProgressPercent(2, 4, 45)).toBe(23);
		expect(slideProgressPercent(4, 4, 45)).toBe(45);
	});

	it('guards against a zero slide count', () => {
		expect(slideProgressPercent(0, 0)).toBe(0);
	});
});

describe('recordProgressPercent', () => {
	it('maps the record phase onto the upper [45, 90] band', () => {
		expect(recordProgressPercent(0, 4)).toBe(45);
		expect(recordProgressPercent(2, 4)).toBe(68);
		expect(recordProgressPercent(4, 4)).toBe(90);
	});

	it('returns the band floor when there are no slides', () => {
		expect(recordProgressPercent(0, 0)).toBe(45);
	});
});

describe('slideStatusLabel', () => {
	it('builds a 1-based "verb slide N of M" label from a 0-based cursor', () => {
		expect(slideStatusLabel('Rendering', 0, 10)).toBe('Rendering slide 1 of 10...');
		expect(slideStatusLabel('Capturing', 4, 10)).toBe('Capturing slide 5 of 10...');
	});
});

describe('abort-error helpers', () => {
	it('exportAbortError produces an AbortError DOMException', () => {
		const err = exportAbortError();
		expect(err).toBeInstanceOf(DOMException);
		expect(err.name).toBe('AbortError');
	});

	it('isExportAbortError recognises only the abort error', () => {
		expect(isExportAbortError(exportAbortError())).toBeTruthy();
		expect(isExportAbortError(new Error('boom'))).toBeFalsy();
		expect(isExportAbortError(new DOMException('other', 'NotFoundError'))).toBeFalsy();
		expect(isExportAbortError(undefined)).toBeFalsy();
	});
});

describe('reserved tail constants', () => {
	it('exposes the assembling/done percentages', () => {
		expect(EXPORT_ASSEMBLING_PERCENT).toBe(95);
		expect(EXPORT_DONE_PERCENT).toBe(100);
	});
});
