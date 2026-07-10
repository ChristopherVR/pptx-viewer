import { describe, expect, it } from 'vitest';

import { createTranslator, interpolate, registerTranslations, translate } from './translator';

describe('translator', () => {
	it('resolves keys from the shared English dictionary', () => {
		expect(translate('en', 'pptx.statusBar.zoomIn')).toBe('Zoom in');
	});

	it('interpolates {{name}} placeholders', () => {
		expect(translate('en', 'pptx.statusBar.slideOf', { current: 2, total: 9 })).toBe(
			'Slide 2 of 9',
		);
		expect(interpolate('{{a}} + {{a}} = {{b}}', { a: 1, b: 2 })).toBe('1 + 1 = 2');
	});

	it('leaves unknown placeholders untouched', () => {
		expect(interpolate('Hello {{who}}', {})).toBe('Hello {{who}}');
	});

	it('falls back to English, then to a humanised label for missing keys', () => {
		expect(translate('fr', 'pptx.statusBar.zoomOut')).toBe('Zoom out');
		expect(translate('en', 'pptx.some.missingKeyName')).toBe('Missing Key Name');
	});

	it('supports registered locales with base-language fallback', () => {
		registerTranslations('fr', { 'pptx.statusBar.zoomIn': 'Zoom avant' });
		expect(translate('fr', 'pptx.statusBar.zoomIn')).toBe('Zoom avant');
		expect(translate('fr-CA', 'pptx.statusBar.zoomIn')).toBe('Zoom avant');
	});

	it('merges later registrations over earlier ones', () => {
		registerTranslations('de', { 'a.b': 'eins' });
		registerTranslations('de', { 'a.c': 'zwei' });
		expect(translate('de', 'a.b')).toBe('eins');
		expect(translate('de', 'a.c')).toBe('zwei');
	});

	it('createTranslator reads the locale lazily', () => {
		let locale = 'en';
		const t = createTranslator(() => locale);
		expect(t('pptx.statusBar.zoomIn')).toBe('Zoom in');
		locale = 'fr';
		expect(t('pptx.statusBar.zoomIn')).toBe('Zoom avant');
	});
});
