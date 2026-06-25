import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types';

/**
 * Integration: a text run that is an OOXML field (`a:fld`) must survive save
 * even when its run style matches the surrounding text.
 *
 * Regression guard: `areTextSegmentsUniform` previously compared only visual
 * styles, so a slide-number field whose run style equalled its neighbours was
 * judged "uniform"; the save path then serialized from the flat `el.text`
 * string and the field was silently downgraded to static text (a frozen number
 * that no longer tracks the slide). The fix treats a segment carrying a
 * structural marker (field / equation / ruby) as non-uniform so it is preserved.
 */
describe('uniform-styled field segment round-trip', () => {
	const fixturePath = path.resolve(__dirname, '../fixtures/embedded-assets-sample.pptx');
	const hasFixture = fs.existsSync(fixturePath);

	it.skipIf(!hasFixture)(
		'preserves a slidenum a:fld whose run style matches its text',
		async () => {
			const fileBytes = fs.readFileSync(fixturePath);
			const buffer = fileBytes.buffer.slice(
				fileBytes.byteOffset,
				fileBytes.byteOffset + fileBytes.byteLength,
			) as ArrayBuffer;

			const handler = new PptxHandler();
			const data = await handler.load(buffer);
			const slide = data.slides[0];

			// A footer-style "Slide #" run where the field shares the surrounding style.
			const sharedStyle = { fontSize: 16, color: '#5f6368' };
			const fieldElement = {
				id: 'rt-field-el',
				type: 'text',
				x: 40,
				y: 40,
				width: 160,
				height: 30,
				text: 'Slide #',
				textStyle: sharedStyle,
				textSegments: [
					{ text: 'Slide ', style: sharedStyle },
					{
						text: '#',
						style: sharedStyle,
						fieldType: 'slidenum',
						fieldGuid: '{F8166F1F-CE9B-4651-A6AA-CD717754DC9D}',
						fieldGuidAttr: 'id' as const,
					},
				],
			} as unknown as PptxElement;
			slide.elements.push(fieldElement);

			const saved = await handler.save(data.slides);
			const reloaded = await handler.load(
				saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
			);

			const el = reloaded.slides[0].elements.find((e) => (e.text ?? '').includes('Slide'));
			expect(el, 'field element missing after round-trip').toBeTruthy();
			const segments = (el as unknown as { textSegments?: Array<{ fieldType?: string }> })
				.textSegments;
			const fieldSegment = segments?.find((s) => s.fieldType === 'slidenum');
			expect(fieldSegment, 'slidenum field was downgraded to static text on save').toBeTruthy();
		},
	);
});
