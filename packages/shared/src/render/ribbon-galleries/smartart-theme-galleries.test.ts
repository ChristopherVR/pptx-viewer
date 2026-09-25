import type { PptxElement, PptxSmartArtData, PptxTheme } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';
import { galleryItemLabel } from './gallery-view';
import { THEME_COLOR_SCHEME_ROWS } from './theme-color-schemes-data';
import { THEME_FONT_SCHEME_ROWS } from './theme-font-schemes-data';

function smartArt(data: Partial<PptxSmartArtData> = {}): PptxElement {
	return {
		id: 'sa1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		smartArtData: { nodes: [{ id: 'n1', text: 'One' }], ...data },
	} as PptxElement;
}

describe('smartArt galleries', () => {
	it('offers the model colour schemes under PowerPoint names', () => {
		const descriptor = buildRibbonGallery('smartArtColors', {
			element: smartArt({ colorScheme: 'colorful2' }),
		});
		expect(descriptor.sections.map((s) => s.items.map((i) => i.id))).toStrictEqual([
			['colorful1', 'colorful2', 'colorful3'],
			['monochromatic1'],
			['monochromatic2'],
		]);
		const item = descriptor.sections[0].items[1];
		expect(item.applied).toBeTruthy();
		expect(item.labelParams).toStrictEqual({ from: 2, to: 3 });
		expect(galleryItemLabel(item, (key) => key)).toBe('Colorful Range - Accent Colors 2 to 3');
	});

	it('applies a colour scheme and a style through the shared patch', () => {
		const colors = applyRibbonGalleryItem('smartArtColors', 'monochromatic1', {
			element: smartArt(),
		});
		expect(colors).toMatchObject({
			kind: 'element',
			elementId: 'sa1',
			patch: { smartArtData: { colorScheme: 'monochromatic1' } },
		});
		const styles = buildRibbonGallery('smartArtStyles', {
			element: smartArt({ style: 'intense' }),
		});
		expect(styles.sections[0].items.map((i) => [i.id, i.label, i.applied])).toStrictEqual([
			['flat', 'Simple Fill', false],
			['moderate', 'Moderate Effect', false],
			['intense', 'Intense Effect', true],
		]);
		const style = applyRibbonGalleryItem('smartArtStyles', 'moderate', { element: smartArt() });
		expect(style).toMatchObject({ patch: { smartArtData: { style: 'moderate' } } });
		expect(applyRibbonGalleryItem('smartArtStyles', 'flat', { element: null })).toBeNull();
		expect(buildRibbonGallery('smartArtStyles', { element: null }).disabled).toBeTruthy();
	});
});

const OFFICE_2013: PptxTheme = {
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#44546A',
		lt2: '#E7E6E6',
		accent1: '#4472C4',
		accent2: '#ED7D31',
		accent3: '#A5A5A5',
		accent4: '#FFC000',
		accent5: '#5B9BD5',
		accent6: '#70AD47',
		hlink: '#0563C1',
		folHlink: '#954F72',
	},
	fontScheme: { majorFont: { latin: 'Calibri Light' }, minorFont: { latin: 'Calibri' } },
};

describe('theme Variants galleries', () => {
	it('lists Office plus the 23 installed colour schemes and marks the deck scheme', () => {
		expect(THEME_COLOR_SCHEME_ROWS).toHaveLength(24);
		const descriptor = buildRibbonGallery('themeColors', { element: null, theme: OFFICE_2013 });
		const items = descriptor.sections[0].items;
		expect(items).toHaveLength(24);
		expect(items[0].label).toBe('Office');
		expect(items.filter((i) => i.applied).map((i) => i.id)).toStrictEqual(['office-2013-2022']);
		const result = applyRibbonGalleryItem('themeColors', 'blue-ii', { element: null });
		expect(result).toMatchObject({
			kind: 'themeColorScheme',
			name: 'Blue II',
			colorScheme: { accent1: '#1CADE4', dk2: '#335B74' },
		});
	});

	it('heads the list with a custom deck scheme', () => {
		const custom = {
			...OFFICE_2013,
			colorScheme: { ...OFFICE_2013.colorScheme!, accent1: '#123456' },
		};
		const descriptor = buildRibbonGallery('themeColors', { element: null, theme: custom });
		expect(descriptor.sections[0].items[0]).toMatchObject({ id: 'current', applied: true });
		expect(
			applyRibbonGalleryItem('themeColors', 'current', { element: null, theme: custom }),
		).toMatchObject({ kind: 'themeColorScheme', colorScheme: { accent1: '#123456' } });
	});

	it('lists Office plus the 25 installed font schemes and applies major/minor latin', () => {
		expect(THEME_FONT_SCHEME_ROWS).toHaveLength(26);
		const descriptor = buildRibbonGallery('themeFonts', { element: null, theme: OFFICE_2013 });
		const items = descriptor.sections[0].items;
		expect(items[0].labelParams).toStrictEqual({
			name: 'Office',
			major: 'Aptos Display',
			minor: 'Aptos',
		});
		expect(items.filter((i) => i.applied).map((i) => i.id)).toStrictEqual(['office-2013-2022']);
		expect(items[0].previewSvg).toContain('Aptos Display');
		expect(applyRibbonGalleryItem('themeFonts', 'georgia', { element: null })).toStrictEqual({
			kind: 'themeFontScheme',
			name: 'Georgia',
			fontScheme: { majorFont: { latin: 'Georgia' }, minorFont: { latin: 'Georgia' } },
		});
		expect(applyRibbonGalleryItem('themeFonts', 'nope', { element: null })).toBeNull();
	});
});
