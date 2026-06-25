import { describe, expect, it } from 'vitest';

import { resolveFieldDateText, substituteFieldText } from './text-field-substitution';

describe('substituteFieldText', () => {
	it('returns the raw text without a field type or context', () => {
		expect(substituteFieldText('x', undefined, { slideNumber: 3 })).toBe('x');
		expect(substituteFieldText('x', 'slidenum', undefined)).toBe('x');
	});

	it('substitutes the slide number', () => {
		expect(substituteFieldText('1', 'slidenum', { slideNumber: 42 })).toBe('42');
	});

	it('substitutes header and footer text', () => {
		expect(substituteFieldText('', 'footer', { footerText: 'Foot' })).toBe('Foot');
		expect(substituteFieldText('', 'header', { headerText: 'Head' })).toBe('Head');
	});

	it('substitutes a slide title', () => {
		expect(substituteFieldText('', 'slidetitle', { slideTitle: 'Intro' })).toBe('Intro');
	});

	it('looks up a named document property', () => {
		const ctx = { customProperties: [{ name: 'Author', value: 'Ada' }] };
		expect(substituteFieldText('', 'docproperty.Author', ctx)).toBe('Ada');
		expect(substituteFieldText('orig', 'docproperty.Missing', ctx)).toBe('orig');
	});

	it('formats datetime fields with the explicit dateFormat', () => {
		const out = substituteFieldText('', 'datetime1', { dateFormat: 'yyyy' });
		expect(out).toMatch(/^\d{4}$/u);
	});
});

describe('resolveFieldDateText', () => {
	it('honours an explicit format pattern', () => {
		const fixed = new Date(2023, 0, 5); // 5 Jan 2023
		// The helper builds its own `new Date()`, so assert on a format with a
		// stable shape rather than an exact value.
		expect(resolveFieldDateText('datetime1', 'yyyy')).toMatch(/^\d{4}$/u);
		expect(fixed.getFullYear()).toBe(2023); // sanity: Date constructor works
	});

	it('uses a known datetime type format', () => {
		// datetime5 -> dd-MMM-yy
		expect(resolveFieldDateText('datetime5')).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{2}$/u);
	});

	it('falls back to a locale date string for unknown types', () => {
		expect(resolveFieldDateText('weird')).toBeTypeOf('string');
	});
});
