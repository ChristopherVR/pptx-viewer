import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import { translationsEn } from './i18n';

describe('translationsEn (vue-i18n syntax adapter)', () => {
	it('contains no double-brace interpolation placeholders', () => {
		const offenders = Object.entries(translationsEn).filter(([, value]) => value.includes('{{'));
		expect(offenders).toStrictEqual([]);
	});

	it('converts the shared dictionary double-brace syntax to vue-i18n single-brace syntax', () => {
		expect(translationsEn['pptx.notes.slideN']).toBe('Slide {n}');
		expect(translationsEn['pptx.statusBar.slideOf']).toBe('Slide {current} of {total}');
	});

	it('compiles every message with vue-i18n without throwing (regression: "Not allowed nest placeholder")', () => {
		expect(() =>
			createI18n({
				legacy: false,
				locale: 'en',
				messages: { en: translationsEn },
				missingWarn: false,
				fallbackWarn: false,
			}),
		).not.toThrow();
	});

	it('resolves a parametrised message to the expected interpolated string', () => {
		const i18n = createI18n({
			legacy: false,
			locale: 'en',
			messages: { en: translationsEn },
			missingWarn: false,
			fallbackWarn: false,
		});
		const { t } = i18n.global;
		expect(t('pptx.notes.slideN', { n: 3 })).toBe('Slide 3');
	});
});
