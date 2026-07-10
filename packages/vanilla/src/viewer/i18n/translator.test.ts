import { describe, expect, it } from 'vitest';

import { createTranslator } from './translator';

describe('createTranslator', () => {
	it('resolves keys from the built-in English dictionary', () => {
		const t = createTranslator();
		expect(t('pptx.statusBar.noSlides')).toBe('No slides');
	});

	it('interpolates {{param}} placeholders', () => {
		const t = createTranslator();
		expect(t('pptx.statusBar.slideOf', { current: 2, total: 9 })).toBe('Slide 2 of 9');
	});

	it('falls back to a humanised label for unknown keys', () => {
		const t = createTranslator();
		expect(t('pptx.something.veryMissingKey')).toBe('Very Missing Key');
	});

	it('prefers host messages for the active locale, falling back to English', () => {
		const t = createTranslator('de', {
			de: { 'pptx.presenter.nextSlide': 'Nächste Folie' },
		});
		expect(t('pptx.presenter.nextSlide')).toBe('Nächste Folie');
		// Not overridden in de: falls back to built-in English.
		expect(t('pptx.presenter.previousSlide')).toBe('Previous Slide');
	});

	it('lets host English messages override the built-in dictionary', () => {
		const t = createTranslator('en', { en: { 'pptx.statusBar.noSlides': 'Empty deck' } });
		expect(t('pptx.statusBar.noSlides')).toBe('Empty deck');
	});

	it('leaves unknown placeholders untouched', () => {
		const t = createTranslator('en', { en: { greeting: 'Hi {{name}} and {{other}}' } });
		expect(t('greeting', { name: 'Ada' })).toBe('Hi Ada and {{other}}');
	});
});
