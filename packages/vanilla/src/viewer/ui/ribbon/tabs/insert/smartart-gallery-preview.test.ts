import { PRESETS } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../../../i18n';
import { buildSmartArtGalleryPreview } from './smartart-gallery-preview';

describe('buildSmartArtGalleryPreview', () => {
	it('renders the real SmartArt output for the preset, not a generic icon', () => {
		const preset = PRESETS[0];
		const tile = buildSmartArtGalleryPreview(document, createTranslator(), preset.layout);
		// The live renderer paints a `.pptxv-smartart` element (chrome + shapes);
		// a generic placeholder icon would carry no such structure.
		expect(tile.querySelector('.pptxv-smartart')).toBeTruthy();
	});

	it('scales the full-size preview element down to gallery tile width', () => {
		const preset = PRESETS[0];
		const tile = buildSmartArtGalleryPreview(document, createTranslator(), preset.layout);
		expect(tile.style.width).toBe('64px');
		const stage = tile.firstElementChild as HTMLElement;
		expect(stage.style.transform).toContain('scale(');
	});

	it('renders a distinct diagram per layout', () => {
		const [first, second] = PRESETS;
		const t = createTranslator();
		const a = buildSmartArtGalleryPreview(document, t, first.layout);
		const b = buildSmartArtGalleryPreview(document, t, second.layout);
		expect(a.querySelector('.pptxv-smartart')?.getAttribute('data-testid')).not.toBe(
			b.querySelector('.pptxv-smartart')?.getAttribute('data-testid'),
		);
	});
});
