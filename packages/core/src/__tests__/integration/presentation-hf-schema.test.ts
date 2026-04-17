import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';

/**
 * `<p:hf>` is NOT a valid child of `<p:presentation>` per the OOXML schema —
 * it belongs on slide masters, notes masters, handout masters, and slides.
 * Writing it at the presentation root produces a
 * `Sch_InvalidElementContentExpectingComplex` validation error and triggers
 * PowerPoint's file-corruption / repair dialog.
 *
 * The react editor always passes a (possibly empty) `headerFooter` object
 * through the save pipeline. Before the fix, this bypassed the falsy
 * early-return in `applyHeaderFooter` and emitted an empty `<p:hf/>` at the
 * presentation root — PowerPoint then refused to open the file without
 * running repair.
 */
describe('presentation.xml header/footer schema', () => {
	it('does not emit <p:hf> at the p:presentation root when headerFooter is empty', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText('hello', { x: 10, y: 10, width: 200, height: 50 }).build(),
		);
		const savedBytes = await handler.save(data.slides, {
			headerFooter: {} as Parameters<typeof handler.save>[1] extends infer O
				? O extends { headerFooter?: infer H }
					? H
					: never
				: never,
		});
		const saved = await JSZip.loadAsync(savedBytes);
		const presXml = await saved.file('ppt/presentation.xml')!.async('string');

		expect(presXml).not.toMatch(/<p:hf[\s/>]/);
	});

	it('does not emit <p:hf> at the p:presentation root when headerFooter is undefined', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText('hello', { x: 10, y: 10, width: 200, height: 50 }).build(),
		);
		const savedBytes = await handler.save(data.slides);
		const saved = await JSZip.loadAsync(savedBytes);
		const presXml = await saved.file('ppt/presentation.xml')!.async('string');

		expect(presXml).not.toMatch(/<p:hf[\s/>]/);
	});
});
