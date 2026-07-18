import { describe, expect, it } from 'vitest';

import { summarizeToolArgs, toolLabel } from './tool-summary';

describe('toolLabel', () => {
	it('title-cases a snake_case tool name', () => {
		expect(toolLabel('update_text')).toBe('Update text');
		expect(toolLabel('set_slide_transition')).toBe('Set slide transition');
	});

	it('falls back to Tool for an empty name', () => {
		expect(toolLabel('')).toBe('Tool');
	});
});

describe('summarizeToolArgs', () => {
	it('presents zero-based slideIndex as a 1-based slide number', () => {
		expect(summarizeToolArgs({ slideIndex: 2 })).toBe('slide 3');
	});

	it('drops empty fields and truncates long strings', () => {
		const long = 'x'.repeat(40);
		expect(summarizeToolArgs({ text: long, note: '' })).toBe(`text: "${'x'.repeat(32)}..."`);
	});

	it('caps the summary at four fields with an ellipsis', () => {
		const summary = summarizeToolArgs({ a: 1, b: 2, c: 3, d: 4, e: 5 });
		expect(summary.endsWith('...')).toBeTruthy();
	});

	it('returns an empty string for non-object input', () => {
		expect(summarizeToolArgs(null)).toBe('');
		expect(summarizeToolArgs('hi')).toBe('');
	});
});
