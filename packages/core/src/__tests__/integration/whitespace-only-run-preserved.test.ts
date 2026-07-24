import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types/elements';

/**
 * Regression for GitHub issue #52: PowerPoint often splits a sentence into
 * many `<a:r>` runs (spell-check squiggles, autocorrect, etc.), and a word
 * boundary frequently ends up as its own run whose `<a:t>` is a single
 * space character, e.g. `<a:r><a:t> </a:t></a:r>`. fast-xml-parser's
 * default `trimValues: true` trims that whitespace-only text node down to
 * `""`, silently dropping the space and gluing the surrounding words
 * together on load (e.g. "so we immediately start" -> "soweimmediatelystart").
 */

function textOf(el: PptxElement): string {
	if ('textSegments' in el && Array.isArray(el.textSegments) && el.textSegments.length > 0) {
		return el.textSegments.map((s) => s.text ?? '').join('');
	}
	return 'text' in el && typeof el.text === 'string' ? el.text : '';
}

describe('whitespace-only run text is preserved on load', () => {
	it('keeps a standalone single-space run between two other runs', async () => {
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr>
				<p:cNvPr id="1" name=""/>
				<p:cNvGrpSpPr/>
				<p:nvPr/>
			</p:nvGrpSpPr>
			<p:grpSpPr>
				<a:xfrm>
					<a:off x="0" y="0"/>
					<a:ext cx="0" cy="0"/>
					<a:chOff x="0" y="0"/>
					<a:chExt cx="0" cy="0"/>
				</a:xfrm>
			</p:grpSpPr>
			<p:sp>
				<p:nvSpPr>
					<p:cNvPr id="2" name="TextBox 1"/>
					<p:cNvSpPr txBox="1"/>
					<p:nvPr/>
				</p:nvSpPr>
				<p:spPr>
					<a:xfrm>
						<a:off x="914400" y="914400"/>
						<a:ext cx="3657600" cy="914400"/>
					</a:xfrm>
					<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
				</p:spPr>
				<p:txBody>
					<a:bodyPr/>
					<a:lstStyle/>
					<a:p>
						<a:r><a:rPr lang="en-US" dirty="0"/><a:t>so</a:t></a:r>
						<a:r><a:rPr lang="en-US" dirty="0"/><a:t> </a:t></a:r>
						<a:r><a:rPr lang="en-US" dirty="0" err="1"/><a:t>we</a:t></a:r>
						<a:r><a:rPr lang="en-US" dirty="0"/><a:t> immediately start</a:t></a:r>
					</a:p>
				</p:txBody>
			</p:sp>
		</p:spTree>
	</p:cSld>
</p:sld>`;
		const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

		const { handler: srcHandler, data: srcData, createSlide } = await PresentationBuilder.create();
		srcData.slides.push(createSlide('Blank').build());
		const baseBytes = await srcHandler.save(srcData.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsXml);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		const el = reloaded.slides[0].elements.find((e) => textOf(e).includes('so'));
		expect(el, 'text element should have been parsed').toBeDefined();
		expect(textOf(el!)).toBe('so we immediately start');
	});

	it('marks boundary whitespace for preservation when saving a native bullet', async () => {
		const {
			handler: seedHandler,
			data: seedData,
			createSlide,
		} = await PresentationBuilder.create();
		seedData.slides.push(
			createSlide('Blank').addText('test', { x: 40, y: 40, width: 240, height: 40 }).build(),
		);
		const source = await seedHandler.save(seedData.slides);

		const handler = new PptxHandler();
		const loaded = await handler.load(source.buffer as ArrayBuffer);
		const element = loaded.slides[0]?.elements.find(
			(candidate) => candidate.type === 'text' && candidate.text?.includes('test'),
		);
		expect(element?.type).toBe('text');
		if (element?.type !== 'text' || !element.textSegments?.[0]) {
			return;
		}
		element.textSegments[0].text = '   test ';
		element.textSegments[0].bulletInfo = { char: '-' };

		const saved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('string');
		expect(slideXml).toContain('<a:t xml:space="preserve">   test </a:t>');

		const reloaded = await handler.load(saved.buffer as ArrayBuffer);
		const reloadedElement = reloaded.slides[0]?.elements.find(
			(candidate) => candidate.type === 'text' && candidate.text?.includes('test'),
		);
		expect(reloadedElement?.type).toBe('text');
		if (reloadedElement?.type === 'text') {
			expect(reloadedElement.textSegments?.find((segment) => !segment.bulletInfo)?.text).toBe(
				'   test ',
			);
		}
	});
});
