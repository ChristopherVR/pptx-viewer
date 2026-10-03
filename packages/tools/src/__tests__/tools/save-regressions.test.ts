import JSZip from 'jszip';
import { createLayout, hasTextProperties, PptxHandler } from 'ooxml-core/pptx';
import { describe, expect, it } from 'vitest';

import { replaceText } from '../../tools/content-tools.js';
import { updateElement } from '../../tools/element-tools.js';
import { applyLayout } from '../../tools/layout-tools.js';
import { addSlide } from '../../tools/slide-tools.js';
import { createTestPptxBytes } from '../helpers/create-test-pptx.js';

async function bulletDeck() {
	const zip = await JSZip.loadAsync(await createTestPptxBytes(1));
	const path = 'ppt/slides/slide1.xml';
	const xml = await zip.file(path)!.async('string');
	const paragraphs = ['First point', 'Second point']
		.map(
			(text) =>
				`<a:p><a:pPr marL="342900" indent="-342900"><a:lnSpc><a:spcPct val="120000"/></a:lnSpc><a:spcAft><a:spcPts val="600"/></a:spcAft><a:buFont typeface="Arial"/><a:buChar char="✓"/></a:pPr><a:r><a:t>${text}</a:t></a:r></a:p>`,
		)
		.join('');
	zip.file(
		path,
		xml.replace(
			/<p:txBody>[\s\S]*?<\/p:txBody>/,
			`<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody>`,
		),
	);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const handler = new PptxHandler();
	const pptxData = await handler.load(bytes.buffer as ArrayBuffer);
	const element = pptxData.slides[0].elements.find(
		(candidate) => hasTextProperties(candidate) && candidate.text?.includes('First point'),
	)!;
	if (!hasTextProperties(element)) {
		throw new Error('Missing text');
	}
	return { handler, pptxData, element };
}

describe('issue 356: text edits retain native bullets and paragraph formatting', () => {
	for (const mode of ['replace', 'segments', 'segments-and-text', 'text'] as const) {
		it(`round-trips a ${mode} edit without changing the other paragraph`, async () => {
			const { handler, pptxData, element } = await bulletDeck();
			if (mode === 'replace') {
				replaceText({ pptxData }, { query: 'Second point', replacement: 'Second point, edited' });
			} else if (mode === 'text') {
				updateElement(
					{ pptxData },
					{
						slideIndex: 0,
						elementId: element.id,
						text: element.text!.replace('Second point', 'Second point, edited'),
					},
				);
			} else {
				const segments = structuredClone(element.textSegments!);
				for (const segment of segments) {
					segment.text = segment.text.replace('Second point', 'Second point, edited');
				}
				updateElement(
					{ pptxData },
					{
						slideIndex: 0,
						elementId: element.id,
						textSegments: segments,
						text:
							mode === 'segments-and-text'
								? segments.map((segment) => segment.text).join('')
								: undefined,
					},
				);
			}
			const out = await handler.save(pptxData.slides);
			const zip = await JSZip.loadAsync(out);
			const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
			const body = xml.match(/<p:txBody>[\s\S]*?<\/p:txBody>/)![0];
			expect(body.match(/<a:p>/g)).toHaveLength(2);
			expect(body.match(/<a:buChar char="✓"/g)).toHaveLength(2);
			expect(body.match(/marL="342900"/g)).toHaveLength(2);
			expect(body.match(/indent="-342900"/g)).toHaveLength(2);
			expect(body.match(/val="120000"/g)).toHaveLength(2);
			expect(body.match(/val="600"/g)).toHaveLength(2);
			expect(body.match(/typeface="Arial"/g)).toHaveLength(2);
			expect(body).not.toMatch(/<a:t>✓/);
			expect(body.match(/First point/g)).toHaveLength(1);
			expect(body).toContain('Second point, edited');
			const reloaded = await new PptxHandler().load(out.buffer as ArrayBuffer);
			expect(
				reloaded.slides[0].elements.some(
					(candidate) =>
						hasTextProperties(candidate) && candidate.text?.includes('Second point, edited'),
				),
			).toBeTruthy();
		});
	}
});

describe('issue 357: selected layouts and placeholders survive save', () => {
	for (const newSlide of [true, false]) {
		it(`applies a layout to ${newSlide ? 'a new' : 'an existing'} slide`, async () => {
			const handler = new PptxHandler();
			const bytes = await createTestPptxBytes(1);
			const data = await handler.load(bytes.buffer as ArrayBuffer);
			const custom = await createLayout(handler, data, {
				name: 'Issue 357 Layout',
				type: 'obj',
				placeholders: [
					{ type: 'title', x: 50, y: 20, width: 800, height: 60 },
					{ type: 'body', idx: 1, x: 50, y: 100, width: 800, height: 400 },
				],
			});
			const ctx = { pptxData: custom.data };
			const index = newSlide ? addSlide(ctx, {}).result.newSlideIndex : 0;
			applyLayout(ctx, { slideIndex: index, layoutName: 'Issue 357 Layout' });
			applyLayout(ctx, { slideIndex: index, layoutName: 'Issue 357 Layout' });
			expect(
				ctx.pptxData.slides[index].elements.filter((element) => element.placeholderType),
			).toHaveLength(2);
			const out = await custom.handler.save(ctx.pptxData.slides);
			const zip = await JSZip.loadAsync(out);
			const path = ctx.pptxData.slides[index].id;
			const rels = await zip
				.file(`${path.replace('slides/', 'slides/_rels/')}.rels`)!
				.async('string');
			expect(rels).toContain(custom.layoutPath.replace('ppt/', '../'));
			const xml = await zip.file(path)!.async('string');
			expect(xml.match(/<p:ph\b/g)).toHaveLength(2);
			const reloaded = await new PptxHandler().load(out.buffer as ArrayBuffer);
			expect(reloaded.slides[index].layoutPath).toBe(custom.layoutPath);
			expect(
				reloaded.slides[index].elements.filter((element) => element.placeholderType),
			).toHaveLength(2);
		});
	}
});
