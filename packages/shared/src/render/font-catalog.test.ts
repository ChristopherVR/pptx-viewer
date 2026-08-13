import { describe, it, expect } from 'vitest';

import { buildFontCatalog, resolveDefaultFontFamily } from './font-catalog';

describe('buildFontCatalog', () => {
	it('leads with the two theme fonts, tagged by role', () => {
		const groups = buildFontCatalog({
			themeFonts: { heading: 'Aptos Display', body: 'Aptos' },
			allFonts: ['Arial'],
		});

		expect(groups[0].id).toBe('theme');
		expect(groups[0].entries).toStrictEqual([
			{ family: 'Aptos Display', themeRole: 'heading' },
			{ family: 'Aptos', themeRole: 'body' },
		]);
	});

	it('orders the groups the way PowerPoint does', () => {
		const groups = buildFontCatalog({
			themeFonts: { body: 'Aptos' },
			embeddedFonts: ['Acme Sans'],
			customFonts: ['Uploaded Face'],
			allFonts: ['Arial'],
		});

		expect(groups.map((group) => group.id)).toStrictEqual(['theme', 'embedded', 'custom', 'all']);
	});

	it('omits groups that would be empty', () => {
		const groups = buildFontCatalog({ allFonts: ['Arial'] });

		expect(groups.map((group) => group.id)).toStrictEqual(['all']);
	});

	it('offers a promoted family once only', () => {
		// Arial is both the theme body font and a catalogue entry. Listing it
		// twice gives the user two identical-looking rows.
		const groups = buildFontCatalog({
			themeFonts: { body: 'Arial' },
			allFonts: ['Arial', 'Verdana'],
		});

		expect(groups.find((group) => group.id === 'all')?.entries).toStrictEqual([
			{ family: 'Verdana' },
		]);
	});

	it('dedupes case-insensitively and across groups', () => {
		const groups = buildFontCatalog({
			themeFonts: { heading: 'Aptos' },
			embeddedFonts: ['APTOS', 'Acme Sans'],
			customFonts: ['acme sans'],
			allFonts: ['aptos'],
		});

		expect(groups.find((group) => group.id === 'embedded')?.entries).toStrictEqual([
			{ family: 'Acme Sans' },
		]);
		expect(groups.find((group) => group.id === 'custom')).toBeUndefined();
		expect(groups.find((group) => group.id === 'all')).toBeUndefined();
	});

	it('skips blank and whitespace-only families', () => {
		const groups = buildFontCatalog({
			themeFonts: { heading: '   ', body: 'Aptos' },
			embeddedFonts: ['', '  '],
			allFonts: ['Arial'],
		});

		expect(groups.find((group) => group.id === 'theme')?.entries).toStrictEqual([
			{ family: 'Aptos', themeRole: 'body' },
		]);
		expect(groups.find((group) => group.id === 'embedded')).toBeUndefined();
	});

	it('carries an i18n key on every group', () => {
		const groups = buildFontCatalog({
			themeFonts: { body: 'Aptos' },
			embeddedFonts: ['Acme'],
			customFonts: ['Uploaded'],
			allFonts: ['Arial'],
		});

		expect(groups.map((group) => group.labelKey)).toStrictEqual([
			'pptx.font.group.theme',
			'pptx.font.group.embedded',
			'pptx.font.group.custom',
			'pptx.font.group.all',
		]);
	});

	it('falls back to the shared catalogue when no list is supplied', () => {
		const groups = buildFontCatalog();

		expect(groups).toHaveLength(1);
		expect(groups[0].entries.length).toBeGreaterThan(10);
	});
});

describe('resolveDefaultFontFamily', () => {
	const theme = { heading: 'Aptos Display', body: 'Aptos' };

	it('uses the major font for title placeholders', () => {
		expect(resolveDefaultFontFamily('title', theme)).toBe('Aptos Display');
		expect(resolveDefaultFontFamily('ctrTitle', theme)).toBe('Aptos Display');
	});

	it('uses the minor font for everything else', () => {
		expect(resolveDefaultFontFamily('body', theme)).toBe('Aptos');
		expect(resolveDefaultFontFamily(undefined, theme)).toBe('Aptos');
	});

	it('falls back through the other theme face, then the default', () => {
		expect(resolveDefaultFontFamily('title', { body: 'Aptos' })).toBe('Aptos');
		expect(resolveDefaultFontFamily('body', {})).toBe('Segoe UI');
		expect(resolveDefaultFontFamily('body', undefined, 'Calibri')).toBe('Calibri');
	});
});
