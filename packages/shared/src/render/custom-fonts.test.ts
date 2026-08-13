import { describe, it, expect } from 'vitest';

import { CUSTOM_FONT_ACCEPT, deriveCustomFontDescriptor } from './custom-fonts';

describe('deriveCustomFontDescriptor', () => {
	it('splits the style axes out of the filename', () => {
		expect(deriveCustomFontDescriptor('Inter-SemiBoldItalic.woff2')).toStrictEqual({
			family: 'Inter',
			weight: '600',
			style: 'italic',
		});
	});

	it('registers the four files of one family under a single name', () => {
		// Otherwise the dropdown fills with near-duplicate families and the bold
		// and italic buttons have nothing to combine with.
		const families = [
			'Roboto-Regular.ttf',
			'Roboto-Bold.ttf',
			'Roboto-Italic.ttf',
			'Roboto-BoldItalic.ttf',
		].map((name) => deriveCustomFontDescriptor(name).family);

		expect(new Set(families)).toStrictEqual(new Set(['Roboto']));
	});

	it('maps the common weight names', () => {
		const weightOf = (name: string) => deriveCustomFontDescriptor(name).weight;

		expect(weightOf('Family-Thin.otf')).toBe('100');
		expect(weightOf('Family-Light.otf')).toBe('300');
		expect(weightOf('Family-Regular.otf')).toBe('400');
		expect(weightOf('Family-Medium.otf')).toBe('500');
		expect(weightOf('Family-DemiBold.otf')).toBe('600');
		expect(weightOf('Family-Bold.otf')).toBe('700');
		expect(weightOf('Family-Black.otf')).toBe('900');
	});

	it('does not read "Bold" out of ExtraBold as plain bold', () => {
		expect(deriveCustomFontDescriptor('Family-ExtraBold.otf').weight).toBe('800');
	});

	it('treats oblique as italic', () => {
		expect(deriveCustomFontDescriptor('Family-Oblique.ttf').style).toBe('italic');
	});

	it('normalises separators in multi-word families', () => {
		expect(deriveCustomFontDescriptor('Source_Sans_Pro-Regular.ttf').family).toBe(
			'Source Sans Pro',
		);
		expect(deriveCustomFontDescriptor('Tw-Cen-MT.ttf').family).toBe('Tw Cen MT');
	});

	it('keeps a plain family name untouched', () => {
		expect(deriveCustomFontDescriptor('Wingdings.ttf')).toStrictEqual({
			family: 'Wingdings',
			weight: '400',
			style: 'normal',
		});
	});

	it('reports an empty family when the name is nothing but style tokens', () => {
		// Callers treat this as unusable rather than registering a nameless face.
		expect(deriveCustomFontDescriptor('Bold.ttf').family).toBe('');
	});
});

describe('cUSTOM_FONT_ACCEPT', () => {
	it('advertises both the extensions and the MIME types', () => {
		expect(CUSTOM_FONT_ACCEPT).toContain('.woff2');
		expect(CUSTOM_FONT_ACCEPT).toContain('font/otf');
	});
});
