import type { ZoomPptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ZoomElementRenderer } from './ZoomElementRenderer';

// The real English dictionary, not a key-echoing stub: the badge and the tile
// captions come from `pptx.zoom.*` keys now, so a stub would let this spec pass
// against text no user ever sees.
vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string>) => {
			const text = translationsEn[key];
			if (text === undefined) {
				return key;
			}
			return params
				? text.replace(/\{\{(\w+)\}\}/gu, (_match, name: string) => String(params[name] ?? ''))
				: text;
		},
	}),
}));

describe('zoom element renderer summary zoom', () => {
	it('renders ordered section targets without a Slide Zoom label', () => {
		const element: ZoomPptxElement = {
			id: 'summary',
			type: 'zoom',
			zoomType: 'summary',
			targetSlideIndex: 1,
			x: 10,
			y: 20,
			width: 200,
			height: 100,
			summaryLayout: 'grid',
			summaryTargets: [
				{
					sectionId: 'intro',
					targetSlideIndex: 1,
					x: 10,
					y: 20,
					width: 90,
					height: 100,
					title: 'Intro',
				},
				{
					sectionId: 'details',
					targetSlideIndex: 4,
					x: 120,
					y: 20,
					width: 90,
					height: 100,
					title: 'Details',
				},
			],
		};
		const html = renderToStaticMarkup(<ZoomElementRenderer element={element} />);
		expect(html).toContain('data-zoom-type="summary"');
		expect(html).toContain('data-section-id="intro"');
		expect(html).toContain('data-zoom-target="4"');
		expect(html).toContain('Summary Zoom');
		expect(html).not.toContain('Slide Zoom');
		// The per-tile subtitle is built in shared and translated the same way.
		expect(html).toContain('Slide 2');
	});
});
