/**
 * SlideThumbnail.fixture.test.tsx: end-to-end proof that the sidebar thumbnail
 * renders the same layout-inherited colour and content as the canvas.
 *
 * Regression target: fixture slide 7 is a title-placeholder-only slide whose
 * visible colour is the LAYOUT-inherited background (schemeClr lt2 from
 * slideLayout7 "MAIN_POINT") and whose text is fully inherited. The sidebar
 * preview previously lost that colour/content. This test loads the real .pptx
 * via `PptxHandler`, asserts core resolves the background colour, then renders
 * `SlideThumbnail` and asserts the colour and the Japanese title both appear.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxSlide } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import { partitionTemplateElements } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

import { SlideThumbnail } from './SlideThumbnail';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const FIXTURE = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../../e2e/fixtures/Japanese_10_Slides_1_8_MB_bbd4090b55.pptx',
);

// The layout-inherited background colour (schemeClr lt2) core should resolve.
const SLIDE_7_BG = '#26A69A';
// A stable prefix of slide 7's inherited Japanese title text.
const SLIDE_7_TITLE_PREFIX = '観客に';

describe('slideThumbnail renders layout-inherited colour + content (fixture)', () => {
	let handler: PptxHandler;
	let slides: PptxSlide[];

	beforeAll(async () => {
		const buf = readFileSync(FIXTURE);
		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
		handler = new PptxHandler();
		const data = await handler.load(ab);
		slides = data.slides;
	});

	afterAll(() => {
		handler?.dispose();
	});

	it('core resolves slide 7 background to the layout lt2 colour', () => {
		const slide7 = slides[6];
		expect(slide7).toBeDefined();
		expect(slide7?.backgroundColor).toBeTruthy();
		expect(slide7?.backgroundColor).toBe(SLIDE_7_BG);
	});

	it('applies the resolved background colour and inherited title in the thumbnail', () => {
		const slide7 = slides[6];
		if (!slide7) {
			throw new Error('fixture slide 7 missing');
		}
		// Mirror the sidebar: split inherited template elements out, then compose.
		const { slides: partitioned, templateElementsBySlideId } = partitionTemplateElements([slide7]);
		const composed = partitioned[0];
		if (!composed) {
			throw new Error('partition dropped the slide');
		}

		const html = renderToStaticMarkup(
			<SlideThumbnail
				slide={composed}
				templateElements={templateElementsBySlideId[composed.id] ?? []}
				canvasSize={{ width: 960, height: 540 }}
			/>,
		);

		expect(html).toContain(`background-color:${SLIDE_7_BG}`);
		expect(html).toContain(SLIDE_7_TITLE_PREFIX);
	});
});
