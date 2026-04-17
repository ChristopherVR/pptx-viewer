import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';

/**
 * CT_ShowProperties (in `ppt/presProps.xml` under `<p:presentationPr>/<p:showPr>`)
 * requires its children in a specific order per ECMA-376:
 *   attributes → (present|browse|kiosk)? → (sldAll|sldRg|custShow)? → penClr? → extLst?
 *
 * Before the fix, the save pipeline mutated the existing `showPr` object by
 * deleting and re-adding `<p:present>` / `<p:sldAll>` children *after* an
 * already-present `<p:penClr>` and `<p:extLst>`, producing
 *   `penClr → extLst → present → sldAll`
 * which PowerPoint flags as corruption (Sch_UnexpectedElementContentExpectingComplex)
 * even though the schema-validator-per-part pass misses it because the default
 * root-type map doesn't cover presProps.xml.
 */
describe('presProps.xml <p:showPr> child schema order', () => {
	it('emits present/browse/kiosk before sldAll/sldRg/custShow before penClr before extLst', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText('hello', { x: 10, y: 10, width: 200, height: 50 }).build(),
		);

		const savedBytes = await handler.save(data.slides, {
			presentationProperties: {
				showType: 'present',
				showSlidesMode: 'all',
				penColor: '#FF0000',
			} as Parameters<typeof handler.save>[1] extends infer O
				? O extends { presentationProperties?: infer P }
					? P
					: never
				: never,
		});
		const saved = await JSZip.loadAsync(savedBytes);
		const presPropsFile = saved.file('ppt/presProps.xml');
		expect(presPropsFile, 'ppt/presProps.xml missing from saved zip').not.toBeNull();
		const presPropsXml = await presPropsFile!.async('string');

		const showPrMatch = presPropsXml.match(/<p:showPr\b[^>]*>([\s\S]*?)<\/p:showPr>/);
		expect(showPrMatch, '<p:showPr> not found').not.toBeNull();
		const inner = showPrMatch![1];

		const idx = (token: string) => inner.indexOf(token);
		const presentIdx = idx('<p:present');
		const sldAllIdx = idx('<p:sldAll');
		const penClrIdx = idx('<p:penClr');

		expect(presentIdx).toBeGreaterThanOrEqual(0);
		expect(sldAllIdx).toBeGreaterThan(presentIdx);
		expect(penClrIdx).toBeGreaterThan(sldAllIdx);
	});
});
