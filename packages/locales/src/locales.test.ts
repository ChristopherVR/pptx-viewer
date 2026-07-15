import { describe, expect, it } from 'vitest';

import { translationsDe, translationsEs, translationsFr } from '.';
import { translationsEn } from '../../shared/src/i18n';

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/gu;
const locales = { de: translationsDe, es: translationsEs, fr: translationsFr };

describe('complete locale dictionaries', () => {
	for (const [locale, translations] of Object.entries(locales)) {
		it(`${locale} covers every canonical key`, () => {
			expect(Object.keys(translations).sort()).toStrictEqual(Object.keys(translationsEn).sort());
		});

		it(`${locale} preserves interpolation placeholders`, () => {
			for (const [key, english] of Object.entries(translationsEn)) {
				const expected = [...english.matchAll(PLACEHOLDER_RE)].map(([value]) => value).sort();
				const actual = [...translations[key].matchAll(PLACEHOLDER_RE)]
					.map(([value]) => value)
					.sort();
				expect(actual).toStrictEqual(expected);
			}
		});
	}
});
