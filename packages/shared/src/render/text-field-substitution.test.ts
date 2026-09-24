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

	// Regression: `dateFormat` (the deck's master date-field default TYPE, e.g.
	// "datetime2") used to be fed to the pattern engine as if it were itself a
	// literal format pattern, and unconditionally BEFORE the field's own type -
	// so every date field on a deck with header/footer date settings rendered
	// that literal type string ("datetime2") instead of a formatted date.
	it("never lets the deck's dateFormat type override a field's own datetime type", () => {
		const out = substituteFieldText('', 'datetime5', { dateFormat: 'datetime2' });
		// datetime5 -> dd-MMM-yy, regardless of the deck's datetime2 default.
		expect(out).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{2}$/u);
		expect(out).not.toContain('datetime');
	});

	it('falls back to dateFormat only for the generic, unnumbered "datetime" type', () => {
		const out = substituteFieldText('', 'datetime', { dateFormat: 'datetime6' });
		// datetime6 -> MMMM yy (no day-of-month digits at all).
		expect(out).toMatch(/^[A-Z][a-z]+ \d{2}$/u);
	});

	it("a field's own a:rPr@lang (runLocale) renders in that language regardless of ctx.locale", () => {
		const deDate = substituteFieldText('', 'datetime1', { locale: 'en-US' }, 'de-DE');
		expect(deDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/u);
	});
});

describe('resolveFieldDateText', () => {
	it("uses the field's own recognized type even when dateFormat names a different one", () => {
		// datetime5 -> dd-MMM-yy; dateFormat ("datetime2") must be ignored.
		expect(resolveFieldDateText('datetime5', 'datetime2')).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{2}$/u);
	});

	it('uses dateFormat as the type for the generic "datetime" field', () => {
		// dateFormat names datetime10 (H:mm) as the fallback type.
		expect(resolveFieldDateText('datetime', 'datetime10')).toMatch(/^\d{1,2}:\d{2}$/u);
	});

	it('uses a known datetime type format', () => {
		// datetime5 -> dd-MMM-yy
		expect(resolveFieldDateText('datetime5')).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{2}$/u);
	});

	it('falls back to a locale date string for unknown types', () => {
		expect(resolveFieldDateText('weird')).toBeTypeOf('string');
	});

	// Ground truth captured from PowerPoint through COM (see
	// `pptx-limitations-wave-2026-09-24/audit-text/pp/s15.png`): PowerPoint
	// renders each locale's OWN native date/time convention, not the literal
	// English field-order/punctuation of the requested datetime type.
	describe('locale-aware formatting (verified against PowerPoint via COM)', () => {
		it('renders German short/full/long dates and the collapsed 12-hour time', () => {
			expect(resolveFieldDateText('datetime1', undefined, 'de-DE')).toMatch(
				/^\d{2}\.\d{2}\.\d{4}$/u,
			);
			expect(resolveFieldDateText('datetime2', undefined, 'de-DE')).toMatch(
				/^[A-Za-zÄÖÜäöüß]+, \d{1,2}\. [A-Za-zÄÖÜäöüß]+ \d{4}$/u,
			);
			expect(resolveFieldDateText('datetime4', undefined, 'de-DE')).toMatch(
				/^\d{1,2}\. [A-Za-zÄÖÜäöüß]+ \d{4}$/u,
			);
			// German has no native AM/PM concept: datetime12 (nominally 12-hour)
			// renders the bare time, with no "AM"/"PM" suffix at all.
			const time = resolveFieldDateText('datetime12', undefined, 'de-DE');
			expect(time).toMatch(/^\d{1,2}:\d{2}$/u);
			expect(time).not.toMatch(/[AP]M/u);
		});

		it('renders the French short date day/month/year order', () => {
			expect(resolveFieldDateText('datetime1', undefined, 'fr-FR')).toMatch(
				/^\d{2}\/\d{2}\/\d{4}$/u,
			);
		});

		it('renders genuine Japanese month/day names, not the English fallback', () => {
			// A machine missing the Japanese language pack falls back to English
			// (which is what the COM-captured reference screenshot shows); a
			// browser's ICU-backed `Intl` renders real Japanese regardless.
			const out = resolveFieldDateText('datetime2', undefined, 'ja-JP');
			expect(out).toMatch(/^\d{4}年\d{1,2}月\d{1,2}日/u);
		});

		it('still uses the literal English pattern for an English locale', () => {
			expect(resolveFieldDateText('datetime1', undefined, 'en-US')).toMatch(
				/^\d{1,2}\/\d{1,2}\/\d{4}$/u,
			);
			expect(resolveFieldDateText('datetime1', undefined, undefined)).toMatch(
				/^\d{1,2}\/\d{1,2}\/\d{4}$/u,
			);
		});
	});
});
